import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('whale_club_users')
      .select('wallet_address, twitter_username, nickname, total_points')
      .order('total_points', { ascending: false })
      .limit(20);

    if (error) throw error;

    const leaderboard = (data || []).map((entry: any) => ({
      walletAddress: entry.wallet_address,
      twitterUsername: entry.twitter_username,
      nickname: entry.nickname,
      totalPoints: entry.total_points || 0,
    }));

    return NextResponse.json(leaderboard);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return NextResponse.json({ error: 'Failed to fetch leaderboard' }, { status: 500 });
  }
}