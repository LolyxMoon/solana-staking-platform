import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const STAKEPOINT_TWITTER_ID = process.env.STAKEPOINT_TWITTER_ID || '1986447519216508934';

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
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      'apikey': key!,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=minimal',
    },
    body: JSON.stringify(data),
  });
  return response.ok;
}

export async function POST(request: NextRequest) {
  try {
    const { wallet } = await request.json();
    console.log('=== SYNC DEBUG ===');
    // Removed for security

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
    }

    // Get user
    const users = await supabaseGet('whale_club_users', `wallet_address=eq.${wallet}&select=*`);
    console.log('User found:', users?.length > 0);

    if (!users || users.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = users[0];

    if (!user.twitter_access_token) {
      return NextResponse.json({ error: 'Twitter not connected' }, { status: 400 });
    }

    // Check weekly limit
    if (user.last_synced_at) {
      const lastSync = new Date(user.last_synced_at);
      const daysSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceSync < 7) {
        return NextResponse.json({ 
          error: 'Sync available once per week',
          daysRemaining: Math.ceil(7 - daysSinceSync)
        }, { status: 429 });
      }
    }

    const accessToken = user.twitter_access_token;
    let likesCount = 0;
    let retweetsCount = 0;
    let quotesCount = 0;

    // Get user's liked tweets
    try {
      console.log('Fetching likes for twitter_id:', user.twitter_id);
      const likesResponse = await fetch(
        `https://api.twitter.com/2/users/${user.twitter_id}/liked_tweets?max_results=100&tweet.fields=author_id`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const likesText = await likesResponse.text();
      console.log('Likes response status:', likesResponse.status);
      console.log('Likes response:', likesText);

      if (likesResponse.ok) {
        const likesData = JSON.parse(likesText);
        if (likesData.data) {
          likesCount = likesData.data.filter(
            (tweet: any) => tweet.author_id === STAKEPOINT_TWITTER_ID
          ).length;
        }
      }
    } catch (e) {
      console.error('Error fetching likes:', e);
    }

    // Get user's tweets (for retweets and quotes)
    try {
      console.log('Fetching tweets for twitter_id:', user.twitter_id);
      const tweetsResponse = await fetch(
        `https://api.twitter.com/2/users/${user.twitter_id}/tweets?max_results=100&tweet.fields=referenced_tweets`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      const tweetsText = await tweetsResponse.text();
      console.log('Tweets response status:', tweetsResponse.status);
      console.log('Tweets response:', tweetsText);

      if (tweetsResponse.ok) {
        const tweetsData = JSON.parse(tweetsText);
        if (tweetsData.data) {
          for (const tweet of tweetsData.data) {
            if (tweet.referenced_tweets) {
              for (const ref of tweet.referenced_tweets) {
                if (ref.type === 'retweeted') retweetsCount++;
                else if (ref.type === 'quoted') quotesCount++;
              }
            }
          }
        }
      }
    } catch (e) {
      console.error('Error fetching tweets:', e);
    }

    const totalPoints = likesCount * 1 + retweetsCount * 3 + quotesCount * 5;
    console.log('Points:', { likesCount, retweetsCount, quotesCount, totalPoints });

    // Update user
    const updated = await supabaseUpdate(
      'whale_club_users',
      `wallet_address=eq.${wallet}`,
      {
        likes_count: likesCount,
        retweets_count: retweetsCount,
        quotes_count: quotesCount,
        total_points: totalPoints,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    );

    console.log('Update success:', updated);

    return NextResponse.json({
      success: true,
      likesCount,
      retweetsCount,
      quotesCount,
      totalPoints,
    });
  } catch (error) {
    console.error('Sync error:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}