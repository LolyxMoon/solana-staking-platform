import { NextRequest, NextResponse } from 'next/server';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';

const ADMIN_WALLET = process.env.ADMIN_WALLET;
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

async function supabaseDelete(table: string, query: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: 'DELETE',
    headers: {
      'apikey': key!,
      'Authorization': `Bearer ${key}`,
    },
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

    // ✅ 1. Check admin wallet matches
    if (adminWallet !== ADMIN_WALLET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // ✅ 2. Check timestamp is recent (prevent replay attacks)
    if (!timestamp || Date.now() - timestamp > 5 * 60 * 1000) {
      return NextResponse.json({ error: 'Request expired' }, { status: 400 });
    }

    // ✅ 3. Require signed transaction
    if (!signedTransaction) {
      return NextResponse.json({ error: 'Signature required' }, { status: 400 });
    }

    // ✅ 4. ACTUALLY VERIFY THE SIGNATURE (this was missing!)
    try {
      console.log('🔍 Verifying admin signature...');
      
      // Deserialize the transaction
      const txBuffer = bs58.decode(signedTransaction);
      const tx = Transaction.from(txBuffer);
      
      // Check if transaction has signatures
      if (!tx.signatures || tx.signatures.length === 0) {
        console.log('❌ No signatures found in transaction');
        return NextResponse.json(
          { error: 'Transaction not signed' },
          { status: 401 }
        );
      }

      // Verify the signature is valid
      const isValid = tx.verifySignatures();
      
      if (!isValid) {
        console.log('❌ Transaction signature verification failed');
        return NextResponse.json(
          { error: 'Invalid transaction signature' },
          { status: 401 }
        );
      }

      // Verify the transaction is signed by the admin wallet
      const signerPublicKey = tx.signatures[0].publicKey;
      const adminPublicKey = new PublicKey(ADMIN_WALLET);
      
      if (!signerPublicKey.equals(adminPublicKey)) {
        console.log('❌ Transaction not signed by admin wallet');
        return NextResponse.json(
          { error: 'Transaction not signed by authorized wallet' },
          { status: 401 }
        );
      }

      console.log('✅ Admin signature verified');
      
    } catch (sigError) {
      console.error('❌ Signature verification error:', sigError);
      return NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 401 }
      );
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
      const ineligibleUsers = usersWithBalances.filter((u: any) => !u.isEligible);

      // Delete ineligible users from database
      for (const user of ineligibleUsers) {
        await supabaseDelete('whale_club_users', `wallet_address=eq.${user.wallet_address}`);
      }

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

      const removed = ineligibleUsers.map((u: any) => ({
        walletAddress: u.wallet_address,
        twitterUsername: u.twitter_username,
        totalPoints: u.total_points || 0,
        totalBalance: Math.floor(u.totalBalance),
      }));

      console.log(`✅ Snapshot completed by admin. Eligible: ${distribution.length}, Removed: ${removed.length}`);

      return NextResponse.json({
        totalPoints,
        userCount: distribution.length,
        distribution,
        removed,
        removedCount: removed.length,
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

      console.log('✅ All points reset by admin');

      return NextResponse.json({ success: true, message: 'All points reset' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Distribute error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}