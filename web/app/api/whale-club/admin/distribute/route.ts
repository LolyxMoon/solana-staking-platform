import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

export const dynamic = 'force-dynamic';

const ADMIN_WALLET = 'ecfvkqWdJiYJRyUtWvuYpPWP5faf9GBcA1K6TaDW7wS';
const SPT_MINT = new PublicKey('6uUU2z5GBasaxnkcqiQVHa2SXL68mAXDsq1zYN5Qxrm7');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const MIN_HOLDING = 10_000_000;
const SPT_DECIMALS = 9;

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

async function getWalletBalance(connection: Connection, wallet: string): Promise<number> {
  try {
    const walletPubkey = new PublicKey(wallet);
    const ata = await getAssociatedTokenAddress(SPT_MINT, walletPubkey, false, TOKEN_2022_PROGRAM_ID);
    const accountInfo = await connection.getAccountInfo(ata);
    
    if (accountInfo) {
      const data = accountInfo.data;
      const amountBytes = data.slice(64, 72);
      const amount = Number(new DataView(amountBytes.buffer, amountBytes.byteOffset, 8).getBigUint64(0, true));
      return amount / Math.pow(10, SPT_DECIMALS);
    }
    return 0;
  } catch {
    return 0;
  }
}

async function getStakedBalance(wallet: string): Promise<number> {
  try {
    const stakes = await supabaseGet('user_stake', `user_wallet=eq.${wallet}&token_mint=eq.${SPT_MINT.toString()}&select=staked_amount`);
    if (stakes && stakes.length > 0) {
      return stakes.reduce((sum: number, s: any) => sum + Number(s.staked_amount) / 1e9, 0);
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { adminWallet, action, signedTransaction, timestamp } = await request.json();

    if (adminWallet !== ADMIN_WALLET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    if (!timestamp || Date.now() - timestamp > 5 * 60 * 1000) {
      return NextResponse.json({ error: 'Request expired' }, { status: 400 });
    }

    if (!signedTransaction) {
      return NextResponse.json({ error: 'Signature required' }, { status: 400 });
    }

    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com');

    if (action === 'snapshot') {
      const users = await supabaseGet(
        'whale_club_users',
        `twitter_username=neq._oauth_holder&select=wallet_address,twitter_username,nickname,total_points,likes_count,retweets_count,quotes_count&order=total_points.desc`
      );

      // Check each user's current balance
      const usersWithBalances = await Promise.all(
        users.map(async (u: any) => {
          const walletBalance = await getWalletBalance(connection, u.wallet_address);
          const stakedBalance = await getStakedBalance(u.wallet_address);
          const totalBalance = walletBalance + stakedBalance;
          return {
            ...u,
            walletBalance,
            stakedBalance,
            totalBalance,
            isEligible: totalBalance >= MIN_HOLDING,
          };
        })
      );

      const eligibleUsers = usersWithBalances.filter((u: any) => u.isEligible && u.total_points > 0);
      const ineligibleUsers = usersWithBalances.filter((u: any) => !u.isEligible && u.total_points > 0);

      const totalPoints = eligibleUsers.reduce((sum: number, u: any) => sum + (u.total_points || 0), 0);

      const distribution = eligibleUsers.map((u: any) => ({
        walletAddress: u.wallet_address,
        twitterUsername: u.twitter_username,
        nickname: u.nickname,
        totalPoints: u.total_points || 0,
        likesCount: u.likes_count || 0,
        retweetsCount: u.retweets_count || 0,
        quotesCount: u.quotes_count || 0,
        sharePercent: totalPoints > 0 ? ((u.total_points / totalPoints) * 100).toFixed(2) : '0',
        walletBalance: Math.floor(u.walletBalance),
        stakedBalance: Math.floor(u.stakedBalance),
        totalBalance: Math.floor(u.totalBalance),
      }));

      const excluded = ineligibleUsers.map((u: any) => ({
        walletAddress: u.wallet_address,
        twitterUsername: u.twitter_username,
        totalPoints: u.total_points || 0,
        totalBalance: Math.floor(u.totalBalance),
        reason: `Only holds ${Math.floor(u.totalBalance).toLocaleString()} SPT`,
      }));

      return NextResponse.json({
        totalPoints,
        userCount: distribution.length,
        distribution,
        excluded,
        excludedCount: excluded.length,
      });
    }

    if (action === 'reset') {
      await supabaseUpdate('whale_club_users', `twitter_username=neq._oauth_holder`, {
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