import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: { wallet: string } }
) {
  const wallet = params.wallet;

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('whale_club_users')
      .select('*')
      .eq('wallet_address', wallet)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      walletAddress: data.wallet_address,
      twitterId: data.twitter_id,
      twitterUsername: data.twitter_username,
      nickname: data.nickname,
      totalPoints: data.total_points || 0,
      likesCount: data.likes_count || 0,
      retweetsCount: data.retweets_count || 0,
      quotesCount: data.quotes_count || 0,
      lastSyncedAt: data.last_synced_at,
      createdAt: data.created_at,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 });
  }
}