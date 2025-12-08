import { NextRequest, NextResponse } from 'next/server';
import { Transaction, PublicKey, Connection } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';

export const dynamic = 'force-dynamic';

const SPT_MINT = new PublicKey('6uUU2z5GBasaxnkcqiQVHa2SXL68mAXDsq1zYN5Qxrm7');
const TOKEN_2022_PROGRAM_ID = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const MIN_HOLDING = 10_000_000;
const SPT_DECIMALS = 9;

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
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
    const supabase = getSupabase();
    const { data } = await supabase
      .from('user_stake')
      .select('staked_amount')
      .eq('user_wallet', wallet)
      .eq('token_mint', SPT_MINT.toString());
    
    if (data && data.length > 0) {
      return data.reduce((sum: number, s: any) => sum + Number(s.staked_amount) / 1e9, 0);
    }
    return 0;
  } catch {
    return 0;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { wallet, signedTransaction, timestamp } = await request.json();

    if (!wallet || !signedTransaction || !timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check timestamp is within 5 minutes
    if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
      return NextResponse.json({ error: 'Verification expired' }, { status: 401 });
    }

    // Deserialize and verify the transaction signature
    const txBytes = Buffer.from(signedTransaction, 'base64');
    const transaction = Transaction.from(txBytes);
    
    // Verify the transaction is signed by the wallet
    const walletPubkey = new PublicKey(wallet);
    const isValid = transaction.verifySignatures();
    
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Check if the signer matches the wallet
    const signerPubkey = transaction.signatures[0]?.publicKey;
    if (!signerPubkey || !signerPubkey.equals(walletPubkey)) {
      return NextResponse.json({ error: 'Signer mismatch' }, { status: 401 });
    }

    // Verify user holds 10M+ SPT
    const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.mainnet-beta.solana.com');
    const walletBalance = await getWalletBalance(connection, wallet);
    const stakedBalance = await getStakedBalance(wallet);
    const totalBalance = walletBalance + stakedBalance;

    if (totalBalance < MIN_HOLDING) {
      return NextResponse.json({ 
        error: `Insufficient SPT. You have ${Math.floor(totalBalance).toLocaleString()}, need ${MIN_HOLDING.toLocaleString()}` 
      }, { status: 403 });
    }

    // Generate session token (valid for 24 hours)
    const sessionToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Upsert user - create if doesn't exist, update if exists
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('whale_club_users')
      .upsert({ 
        wallet_address: wallet,
        chat_session_token: sessionToken,
        chat_session_expiry: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      }, {
        onConflict: 'wallet_address',
        ignoreDuplicates: false,
      });

    if (error) {
      console.error('Upsert error:', error);
      return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      sessionToken,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json({ error: 'Verification failed' }, { status: 500 });
  }
}