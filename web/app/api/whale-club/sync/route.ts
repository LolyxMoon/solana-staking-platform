import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

const STAKEPOINT_TWITTER_ID = process.env.STAKEPOINT_TWITTER_ID || '1986447519216508934';

export async function POST(request: NextRequest) {
  try {
    const { wallet } = await request.json();

    if (!wallet) {
      return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Get user with Twitter tokens
    const { data: user, error: userError } = await supabase
      .from('whale_club_users')
      .select('*')
      .eq('wallet_address', wallet)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (!user.twitter_access_token) {
      return NextResponse.json({ error: 'Twitter not connected' }, { status: 400 });
    }

    // Check if synced within last 7 days
    if (user.last_synced_at) {
      const lastSync = new Date(user.last_synced_at);
      const daysSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceSync < 7) {
        const nextSync = new Date(lastSync.getTime() + 7 * 24 * 60 * 60 * 1000);
        return NextResponse.json({ 
          error: 'Sync available once per week',
          nextSyncAt: nextSync.toISOString(),
          daysRemaining: Math.ceil(7 - daysSinceSync)
        }, { status: 429 });
      }
    }

    // Check if token expired
    if (new Date(user.twitter_token_expiry) < new Date()) {
      // Refresh token
      const refreshResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: user.twitter_refresh_token,
        }),
      });

      if (!refreshResponse.ok) {
        return NextResponse.json({ error: 'Token refresh failed, reconnect Twitter' }, { status: 401 });
      }

      const tokens = await refreshResponse.json();
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      await supabase
        .from('whale_club_users')
        .update({
          twitter_access_token: tokens.access_token,
          twitter_refresh_token: tokens.refresh_token,
          twitter_token_expiry: expiresAt.toISOString(),
        })
        .eq('wallet_address', wallet);

      user.twitter_access_token = tokens.access_token;
    }

    const accessToken = user.twitter_access_token;
    let likesCount = 0;
    let retweetsCount = 0;
    let quotesCount = 0;

    // Get user's liked tweets
    try {
      const likesResponse = await fetch(
        `https://api.twitter.com/2/users/${user.twitter_id}/liked_tweets?max_results=100&tweet.fields=author_id`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (likesResponse.ok) {
        const likesData = await likesResponse.json();
        if (likesData.data) {
          likesCount = likesData.data.filter(
            (tweet: any) => tweet.author_id === STAKEPOINT_TWITTER_ID
          ).length;
        }
      } else {
        console.error('Likes fetch failed:', await likesResponse.text());
      }
    } catch (e) {
      console.error('Error fetching likes:', e);
    }

    // Get user's tweets (for retweets and quotes)
    try {
      const tweetsResponse = await fetch(
        `https://api.twitter.com/2/users/${user.twitter_id}/tweets?max_results=100&tweet.fields=referenced_tweets`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (tweetsResponse.ok) {
        const tweetsData = await tweetsResponse.json();
        if (tweetsData.data) {
          for (const tweet of tweetsData.data) {
            if (tweet.referenced_tweets) {
              for (const ref of tweet.referenced_tweets) {
                if (ref.type === 'retweeted') {
                  retweetsCount++;
                } else if (ref.type === 'quoted') {
                  quotesCount++;
                }
              }
            }
          }
        }
      } else {
        console.error('Tweets fetch failed:', await tweetsResponse.text());
      }
    } catch (e) {
      console.error('Error fetching tweets:', e);
    }

    // Calculate points: 1 per like, 3 per retweet, 5 per quote
    const totalPoints = likesCount * 1 + retweetsCount * 3 + quotesCount * 5;

    // Update user
    const { error: updateError } = await supabase
      .from('whale_club_users')
      .update({
        likes_count: likesCount,
        retweets_count: retweetsCount,
        quotes_count: quotesCount,
        total_points: totalPoints,
        last_synced_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('wallet_address', wallet);

    if (updateError) {
      console.error('Update error:', updateError);
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

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