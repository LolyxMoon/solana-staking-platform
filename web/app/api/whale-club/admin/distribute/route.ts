import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const ADMIN_WALLET = 'ecfvkqWdJiYJRyUtWvuYpPWP5faf9GBcA1K6TaDW7wS';

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
    const { adminWallet, action, signedTransaction, timestamp } = await request.json();

    // Verify admin wallet
    if (adminWallet !== ADMIN_WALLET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Verify timestamp is recent (within 5 minutes)
    if (!timestamp || Date.now() - timestamp > 5 * 60 * 1000) {
      return NextResponse.json({ error: 'Request expired' }, { status: 400 });
    }

    // Verify signed transaction exists
    if (!signedTransaction) {
      return NextResponse.json({ error: 'Signature required' }, { status: 400 });
    }

    if (action === 'snapshot') {
      // Get all users with points (exclude stakepointapp holder)
      const users = await supabaseGet(
        'whale_club_users',
        `twitter_username=neq.stakepointapp&select=wallet_address,twitter_username,nickname,total_points,likes_count,retweets_count,quotes_count&order=total_points.desc`
      );

      const totalPoints = users.reduce((sum: number, u: any) => sum + (u.total_points || 0), 0);

      const distribution = users
        .filter((u: any) => u.total_points > 0)
        .map((u: any) => ({
          walletAddress: u.wallet_address,
          twitterUsername: u.twitter_username,
          nickname: u.nickname,
          totalPoints: u.total_points || 0,
          likesCount: u.likes_count || 0,
          retweetsCount: u.retweets_count || 0,
          quotesCount: u.quotes_count || 0,
          sharePercent: totalPoints > 0 ? ((u.total_points / totalPoints) * 100).toFixed(2) : '0',
        }));

      return NextResponse.json({
        totalPoints,
        userCount: distribution.length,
        distribution,
      });
    }

    if (action === 'reset') {
      // Reset all points (exclude stakepointapp holder)
      await supabaseUpdate('whale_club_users', `twitter_username=neq.stakepointapp`, {
        total_points: 0,
        likes_count: 0,
        retweets_count: 0,
        quotes_count: 0,
        last_synced_at: null,
        updated_at: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, message: 'All points reset' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Distribute error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}