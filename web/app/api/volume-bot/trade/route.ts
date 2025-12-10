import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { getAssociatedTokenAddress, getAccount } from '@solana/spl-token';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function parsePrivateKey(key: string): Uint8Array {
  // Handle byte array format: [168,24,11,77,...]
  if (key.startsWith('[')) {
    const bytes = JSON.parse(key);
    return new Uint8Array(bytes);
  }
  // Handle base58 format
  return bs58.decode(key);
}

const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL!;
const CRON_SECRET = process.env.VOLUME_BOT_CRON_SECRET || 'your-secret-key';
const BOT_TOKEN = process.env.VOLUME_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.VOLUME_BOT_ADMIN_CHAT_ID;

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6/quote';
const JUPITER_SWAP_API = 'https://quote-api.jup.ag/v6/swap';

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

async function sendTelegramMessage(text: string) {
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        chat_id: ADMIN_CHAT_ID, 
        text, 
        parse_mode: 'HTML',
        disable_notification: true 
      }),
    });
  } catch {}
}

function randomBetween(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

async function executeSwap(
  connection: Connection,
  wallet: Keypair,
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    // Get quote
    const quoteUrl = `${JUPITER_QUOTE_API}?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amount}&slippageBps=${slippageBps}`;
    const quoteRes = await fetch(quoteUrl);
    
    if (!quoteRes.ok) {
      return { success: false, error: 'Quote failed' };
    }
    
    const quote = await quoteRes.json();
    
    if (!quote || quote.error) {
      return { success: false, error: quote?.error || 'No route found' };
    }

    // Get swap transaction
    const swapRes = await fetch(JUPITER_SWAP_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 'auto',
      }),
    });

    if (!swapRes.ok) {
      return { success: false, error: 'Swap request failed' };
    }

    const swapData = await swapRes.json();
    
    if (!swapData.swapTransaction) {
      return { success: false, error: 'No swap transaction returned' };
    }

    // Deserialize and sign
    const swapTxBuf = Buffer.from(swapData.swapTransaction, 'base64');
    const transaction = VersionedTransaction.deserialize(swapTxBuf);
    transaction.sign([wallet]);

    // Send transaction
    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    // Confirm
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    return { success: true, signature };
  } catch (error: any) {
    return { success: false, error: error.message || 'Swap failed' };
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = getSupabase();
    const connection = new Connection(RPC_URL, 'confirmed');

    // Get config
    const { data: config } = await supabase
      .from('volume_bot_config')
      .select('*')
      .eq('bot_id', 'main')
      .single();

    if (!config?.is_running) {
      return NextResponse.json({ status: 'not_running' });
    }

    if (!config.token_mint) {
      return NextResponse.json({ error: 'No token configured' }, { status: 400 });
    }

    // Get wallets
    const { data: wallets } = await supabase
      .from('volume_bot_wallets')
      .select('*')
      .eq('bot_id', 'main');

    if (!wallets || wallets.length === 0) {
      return NextResponse.json({ error: 'No wallets' }, { status: 400 });
    }

    // Check last trade time (respect interval)
    const { data: lastTrade } = await supabase
      .from('volume_bot_trades')
      .select('created_at')
      .eq('bot_id', 'main')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastTrade) {
      const lastTradeTime = new Date(lastTrade.created_at).getTime();
      const intervalMs = (config.interval_seconds || 60) * 1000;
      const timeSince = Date.now() - lastTradeTime;
      
      if (timeSince < intervalMs) {
        return NextResponse.json({ 
          status: 'waiting', 
          next_trade_in: Math.ceil((intervalMs - timeSince) / 1000) 
        });
      }
    }

    // Pick random wallet
    const randomWallet = wallets[Math.floor(Math.random() * wallets.length)];
    const wallet = Keypair.fromSecretKey(parsePrivateKey(randomWallet.private_key_encrypted));

    // Decide buy or sell
    const solBalance = await connection.getBalance(wallet.publicKey);
    let tokenBalance = 0;
    
    try {
      const ata = await getAssociatedTokenAddress(
        new PublicKey(config.token_mint),
        wallet.publicKey
      );
      const tokenAcc = await getAccount(connection, ata);
      tokenBalance = Number(tokenAcc.amount);
    } catch {}

    const minSolLamports = config.min_sol_amount * LAMPORTS_PER_SOL;
    const canBuy = solBalance > minSolLamports + 0.005 * LAMPORTS_PER_SOL; // Keep some for fees
    const canSell = tokenBalance > 0;

    let tradeType: 'buy' | 'sell';
    
    if (canBuy && canSell) {
      // Random choice weighted by buy_probability
      tradeType = Math.random() < (config.buy_probability || 0.5) ? 'buy' : 'sell';
    } else if (canBuy) {
      tradeType = 'buy';
    } else if (canSell) {
      tradeType = 'sell';
    } else {
      return NextResponse.json({ 
        status: 'insufficient_balance',
        wallet: wallet.publicKey.toString(),
        sol: solBalance / LAMPORTS_PER_SOL,
        token: tokenBalance / Math.pow(10, config.token_decimals || 9)
      });
    }

    // Calculate amount
    const solAmount = randomBetween(config.min_sol_amount, config.max_sol_amount);
    
    let inputMint: string;
    let outputMint: string;
    let amount: number;

    if (tradeType === 'buy') {
      inputMint = SOL_MINT;
      outputMint = config.token_mint;
      amount = Math.floor(solAmount * LAMPORTS_PER_SOL);
    } else {
      inputMint = config.token_mint;
      outputMint = SOL_MINT;
      // Sell percentage of holdings
      const sellPercent = randomBetween(0.1, 0.5); // 10-50%
      amount = Math.floor(tokenBalance * sellPercent);
    }

    // Log trade attempt
    const { data: tradeLog } = await supabase
      .from('volume_bot_trades')
      .insert({
        bot_id: 'main',
        wallet_address: wallet.publicKey.toString(),
        trade_type: tradeType,
        sol_amount: solAmount,
        status: 'pending',
      })
      .select()
      .single();

    // Execute swap
    const result = await executeSwap(
      connection,
      wallet,
      inputMint,
      outputMint,
      amount,
      config.slippage_bps || 300
    );

    // Update trade log
    await supabase
      .from('volume_bot_trades')
      .update({
        status: result.success ? 'success' : 'failed',
        signature: result.signature,
        error_message: result.error,
      })
      .eq('id', tradeLog.id);

    // Send notification
    if (result.success) {
      const emoji = tradeType === 'buy' ? '🟢' : '🔴';
      await sendTelegramMessage(
        `${emoji} <b>${tradeType.toUpperCase()}</b> ${solAmount.toFixed(4)} SOL\n` +
        `Wallet: <code>${wallet.publicKey.toString().slice(0, 8)}...</code>\n` +
        `<a href="https://solscan.io/tx/${result.signature}">View TX</a>`
      );
    }

    return NextResponse.json({
      status: result.success ? 'success' : 'failed',
      trade_type: tradeType,
      sol_amount: solAmount,
      wallet: wallet.publicKey.toString(),
      signature: result.signature,
      error: result.error,
    });
  } catch (error: any) {
    console.error('Trade error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}