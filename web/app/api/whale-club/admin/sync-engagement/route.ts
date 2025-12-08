import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ADMIN_WALLET = 'ecfvkqWdJiYJRyUtWvuYpPWP5faf9GBcA1K6TaDW7wS';
const STAKEPOINT_USER_ID = '1986447519216508934';

async function supabaseGet(table: string, query: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { 'apikey': key!, 'Authorization': `Bearer ${key}` },
  });
  return response.json();
}

async function supabaseUpdate(table: string, query: string, data: any) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      'apikey': key!,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
  });
}

export async function POST(request: NextRequest) {
  try {
    const { wallet, tweetIds } = await request.json();

    // Verify admin
    if (wallet !== ADMIN_WALLET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!tweetIds || !Array.isArray(tweetIds) || tweetIds.length === 0) {
      return NextResponse.json({ error: 'Tweet IDs required' }, { status: 400 });
    }

    const bearerToken = process.env.TWITTER_BEARER_TOKEN;
    if (!bearerToken) {
      return NextResponse.json({ error: 'Twitter bearer token not configured' }, { status: 500 });
    }

    // Get all registered users
    const users = await supabaseGet('whale_club_users', 'twitter_username=not.is.null&select=wallet_address,twitter_username');
    
    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'No users with Twitter registered' }, { status: 400 });
    }

    // Create username lookup map (lowercase)
    const usernameToWallet: Record<string, string> = {};
    for (const user of users) {
      usernameToWallet[user.twitter_username.toLowerCase()] = user.wallet_address;
    }

    const results: Record<string, { likes: number; retweets: number }> = {};

    // For each tweet, get liking users and retweeting users
    for (const tweetId of tweetIds) {
      console.log(`Processing tweet ${tweetId}...`);

      // Get liking users
      try {
        const likesResponse = await fetch(
          `https://api.twitter.com/2/tweets/${tweetId}/liking_users?user.fields=username`,
          { headers: { Authorization: `Bearer ${bearerToken}` } }
        );

        if (likesResponse.ok) {
          const likesData = await likesResponse.json();
          if (likesData.data) {
            for (const user of likesData.data) {
              const username = user.username.toLowerCase();
              if (usernameToWallet[username]) {
                const wallet = usernameToWallet[username];
                if (!results[wallet]) results[wallet] = { likes: 0, retweets: 0 };
                results[wallet].likes++;
              }
            }
          }
        } else {
          console.log(`Likes fetch failed for ${tweetId}:`, await likesResponse.text());
        }
      } catch (e) {
        console.error(`Error fetching likes for ${tweetId}:`, e);
      }

      // Get retweeting users
      try {
        const retweetsResponse = await fetch(
          `https://api.twitter.com/2/tweets/${tweetId}/retweeted_by?user.fields=username`,
          { headers: { Authorization: `Bearer ${bearerToken}` } }
        );

        if (retweetsResponse.ok) {
          const retweetsData = await retweetsResponse.json();
          if (retweetsData.data) {
            for (const user of retweetsData.data) {
              const username = user.username.toLowerCase();
              if (usernameToWallet[username]) {
                const wallet = usernameToWallet[username];
                if (!results[wallet]) results[wallet] = { likes: 0, retweets: 0 };
                results[wallet].retweets++;
              }
            }
          }
        } else {
          console.log(`Retweets fetch failed for ${tweetId}:`, await retweetsResponse.text());
        }
      } catch (e) {
        console.error(`Error fetching retweets for ${tweetId}:`, e);
      }

      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    }

    // Update user points in database
    const updates = [];
    for (const [wallet, engagement] of Object.entries(results)) {
      const points = engagement.likes * 1 + engagement.retweets * 3;
      
      // Get current user data
      const userData = await supabaseGet('whale_club_users', `wallet_address=eq.${wallet}&select=*`);
      if (userData && userData[0]) {
        const user = userData[0];
        const newLikes = (user.likes_count || 0) + engagement.likes;
        const newRetweets = (user.retweets_count || 0) + engagement.retweets;
        const newPoints = newLikes * 1 + newRetweets * 3 + (user.quotes_count || 0) * 5;

        await supabaseUpdate('whale_club_users', `wallet_address=eq.${wallet}`, {
          likes_count: newLikes,
          retweets_count: newRetweets,
          total_points: newPoints,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        updates.push({
          wallet,
          username: user.twitter_username,
          addedLikes: engagement.likes,
          addedRetweets: engagement.retweets,
          addedPoints: points,
          totalPoints: newPoints,
        });
      }
    }

    return NextResponse.json({
      success: true,
      tweetsProcessed: tweetIds.length,
      usersUpdated: updates.length,
      updates,
    });
  } catch (error) {
    console.error('Sync engagement error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
```

**Step 4: You need a Twitter Bearer Token**

Go to Twitter Developer Portal → your app → Keys and Tokens → Generate Bearer Token

Add to Vercel:
```
TWITTER_BEARER_TOKEN=AAAAAAAAAAAAAAAAAAAAAA...