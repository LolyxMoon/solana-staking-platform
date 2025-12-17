import { NextRequest, NextResponse } from 'next/server';
import { Transaction, PublicKey } from '@solana/web3.js';

export const dynamic = 'force-dynamic';

// Admin wallets - bypass all checks
const ADMIN_WALLETS = [
  'YOUR_ADMIN_WALLET_HERE', // Replace with your wallet address
];

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
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

    // Generate session token (valid for 24 hours)
    const sessionToken = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Upsert user
    const supabase = getSupabase();
    
    const { error } = await supabase
      .from('whale_club_users')
      .upsert({ 
        id: crypto.randomUUID(),
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