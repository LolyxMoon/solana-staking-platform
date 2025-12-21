import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ADMIN_WALLET = process.env.ADMIN_WALLET || 'ecfvkqWdJiYJRyUtWvuYpPWP5faf9GBcA1K6TaDW7wS';

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

async function refreshTwitterToken(refreshToken: string): Promise<string | null> {
  try {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    
    const response = await fetch('https://api.twitter.com/2/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${credentials}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    const data = await response.json();
    console.log('Token refresh response:', response.status);

    if (data.access_token) {
      await supabaseUpdate('whale_club_users', `twitter_username=eq._oauth_holder`, {
        twitter_access_token: data.access_token,
        twitter_refresh_token: data.refresh_token || refreshToken,
        twitter_token_expiry: new Date(Date.now() + data.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      });
      return data.access_token;
    }
    
    console.error('Token refresh failed:', data);
    return null;
  } catch (e) {
    console.error('Error refreshing token:', e);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { wallet, tweetIds } = await request.json();

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

    const stakePointUser = await supabaseGet(
      'whale_club_users',
      `twitter_username=eq._oauth_holder&select=twitter_access_token,twitter_refresh_token,twitter_token_expiry`
    );
    
    let userAccessToken = stakePointUser?.[0]?.twitter_access_token;
    const refreshToken = stakePointUser?.[0]?.twitter_refresh_token;
    const tokenExpiry = stakePointUser?.[0]?.twitter_token_expiry;
    
    console.log('StakePoint OAuth token found:', !!userAccessToken);
    console.log('Token expiry:', tokenExpiry);

    if (tokenExpiry && new Date(tokenExpiry) < new Date(Date.now() + 5 * 60 * 1000)) {
      console.log('Token expired or expiring soon, refreshing...');
      if (refreshToken) {
        const newToken = await refreshTwitterToken(refreshToken);
        if (newToken) {
          userAccessToken = newToken;
          console.log('Token refreshed successfully');
        }
      }
    }

    const users = await supabaseGet('whale_club_users', 'twitter_username=not.is.null&select=wallet_address,twitter_username');
    
    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'No users with Twitter registered' }, { status: 400 });
    }

    const usernameToWallet: Record<string, string> = {};
    for (const user of users) {
      if (user.twitter_username.toLowerCase() !== '_oauth_holder') {
        usernameToWallet[user.twitter_username.toLowerCase()] = user.wallet_address;
      }
    }
    console.log('Registered users:', Object.keys(usernameToWallet));

    const results: Record<string, { likes: number; retweets: number }> = {};

    for (const tweetId of tweetIds) {
      console.log(`Processing tweet ${tweetId}...`);

      if (userAccessToken) {
        try {
          let likesResponse = await fetch(
            `https://api.twitter.com/2/tweets/${tweetId}/liking_users?user.fields=username`,
            { headers: { Authorization: `Bearer ${userAccessToken}` } }
          );

          if (likesResponse.status === 401 && refreshToken) {
            console.log('Got 401, attempting token refresh...');
            const newToken = await refreshTwitterToken(refreshToken);
            if (newToken) {
              userAccessToken = newToken;
              likesResponse = await fetch(
                `https://api.twitter.com/2/tweets/${tweetId}/liking_users?user.fields=username`,
                { headers: { Authorization: `Bearer ${userAccessToken}` } }
              );
            }
          }

          const likesText = await likesResponse.text();
          console.log(`Likes response status: ${likesResponse.status}`);
          
          if (likesResponse.ok) {
            const likesData = JSON.parse(likesText);
            console.log('Liking users:', likesData.data?.map((u: any) => u.username));
            if (likesData.data) {
              for (const user of likesData.data) {
                const username = user.username.toLowerCase();
                if (usernameToWallet[username]) {
                  const w = usernameToWallet[username];
                  if (!results[w]) results[w] = { likes: 0, retweets: 0 };
                  results[w].likes++;
                }
              }
            }
          } else {
            console.log(`Likes fetch failed:`, likesText);
          }
        } catch (e) {
          console.error(`Error fetching likes:`, e);
        }
      } else {
        console.log('No OAuth token - skipping likes');
      }

      try {
        const retweetsResponse = await fetch(
          `https://api.twitter.com/2/tweets/${tweetId}/retweeted_by?user.fields=username`,
          { headers: { Authorization: `Bearer ${bearerToken}` } }
        );

        if (retweetsResponse.ok) {
          const retweetsData = await retweetsResponse.json();
          console.log('Retweeting users:', retweetsData.data?.map((u: any) => u.username));
          if (retweetsData.data) {
            for (const user of retweetsData.data) {
              const username = user.username.toLowerCase();
              if (usernameToWallet[username]) {
                const w = usernameToWallet[username];
                if (!results[w]) results[w] = { likes: 0, retweets: 0 };
                results[w].retweets++;
              }
            }
          }
        }
      } catch (e) {
        console.error(`Error fetching retweets:`, e);
      }

      await new Promise(r => setTimeout(r, 100));
    }

    const updates = [];
    for (const [w, engagement] of Object.entries(results)) {
      const points = engagement.likes * 1 + engagement.retweets * 3;
      
      const userData = await supabaseGet('whale_club_users', `wallet_address=eq.${w}&select=*`);
      if (userData && userData[0]) {
        const user = userData[0];
        const newLikes = (user.likes_count || 0) + engagement.likes;
        const newRetweets = (user.retweets_count || 0) + engagement.retweets;
        const newPoints = newLikes * 1 + newRetweets * 3 + (user.quotes_count || 0) * 5;

        await supabaseUpdate('whale_club_users', `wallet_address=eq.${w}`, {
          likes_count: newLikes,
          retweets_count: newRetweets,
          total_points: newPoints,
          last_synced_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        updates.push({
          wallet: w,
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