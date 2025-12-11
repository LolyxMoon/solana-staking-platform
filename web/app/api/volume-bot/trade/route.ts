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
  if (key.startsWith('[')) {
    const bytes = JSON.parse(key);
    return new Uint8Array(bytes);
  }
  return bs58.decode(key);
}

const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT!;
const CRON_SECRET = process.env.VOLUME_BOT_CRON_SECRET || 'your-secret-key';
const BOT_TOKEN = process.env.VOLUME_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.VOLUME_BOT_ADMIN_CHAT_ID;

const SOL_MINT = 'So11111111111111111111111111111111111111112';

const JUPITER_QUOTE_LITE = 'https://lite-api.jup.ag/swap/v1/quote';
const JUPITER_QUOTE_PRO = 'https://api.jup.ag/swap/v1/quote';
const JUPITER_ULTRA_API = 'https://lite-api.jup.ag/ultra/v1/order';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

// Direct REST API calls - no SDK caching
async function supabaseGet(table: string, query: string = '') {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${query}`,
    {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Cache-Control': 'no-cache',
      },
      cache: 'no-store',
    }
  );
  return res.json();
}

async function supabaseInsert(table: string, data: any) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}`,
    {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
      },
      body: JSON.stringify(data),
    }
  );
  return res.json();
}

async function supabaseUpdate(table: string, query: string, data: any) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/${table}?${query}`,
    {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    }
  );
  return res.ok;
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
    const quoteParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      slippageBps: slippageBps.toString(),
    });

    console.log('📡 Fetching Jupiter quote...');
    let quoteRes = await fetch(`${JUPITER_QUOTE_LITE}?${quoteParams}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!quoteRes.ok) {
      console.log('Lite API failed, trying Pro API...');
      quoteRes = await fetch(`${JUPITER_QUOTE_PRO}?${quoteParams}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });
    }

    if (!quoteRes.ok) {
      const errorText = await quoteRes.text();
      console.error('Quote error:', errorText);
      return { success: false, error: `Quote failed: ${quoteRes.status}` };
    }

    const quoteData = await quoteRes.json();
    console.log('✅ Quote received:', {
      inAmount: quoteData.inAmount,
      outAmount: quoteData.outAmount,
    });

    const orderParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount: amount.toString(),
      taker: wallet.publicKey.toString(),
      slippageBps: slippageBps.toString(),
    });

    console.log('📡 Fetching Ultra order...');
    const orderRes = await fetch(`${JUPITER_ULTRA_API}?${orderParams}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!orderRes.ok) {
      const errorText = await orderRes.text();
      console.error('Order error:', errorText);
      return { success: false, error: `Order failed: ${orderRes.status}` };
    }

    const orderData = await orderRes.json();
    
    if (orderData.error) {
      console.error('Jupiter error:', orderData.error);
      return { success: false, error: orderData.error };
    }
    
    if (!orderData.transaction) {
      return { success: false, error: 'No transaction returned from Ultra API' };
    }

    const transactionBuf = Buffer.from(orderData.transaction, 'base64');
    const transaction = VersionedTransaction.deserialize(transactionBuf);
    transaction.sign([wallet]);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    console.log('Transaction sent:', signature);

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    const confirmation = await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    if (confirmation.value.err) {
      return { success: false, error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}` };
    }

    console.log('✅ Swap confirmed!');
    return { success: true, signature };
  } catch (error: any) {
    console.error('Swap execution error:', error);
    return { success: false, error: error.message || 'Swap failed' };
  }
}

async function tradeWithWallet(
  connection: Connection,
  config: any,
  walletData: any
): Promise<{ wallet: string; success: boolean; tradeType?: string; solAmount?: number; signature?: string; error?: string }> {
  try {
    const wallet = Keypair.fromSecretKey(parsePrivateKey(walletData.private_key_encrypted));
    const walletAddress = wallet.publicKey.toString();

    // Check balances
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
    const canBuy = solBalance > minSolLamports + 0.005 * LAMPORTS_PER_SOL;
    const canSell = tokenBalance > 0;

    let tradeType: 'buy' | 'sell';
    
    if (canBuy && canSell) {
      tradeType = Math.random() < (config.buy_probability || 0.5) ? 'buy' : 'sell';
    } else if (canBuy) {
      tradeType = 'buy';
    } else if (canSell) {
      tradeType = 'sell';
    } else {
      return { 
        wallet: walletAddress, 
        success: false, 
        error: 'insufficient_balance' 
      };
    }

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
      const sellPercent = randomBetween(0.1, 0.5);
      amount = Math.floor(tokenBalance * sellPercent);
    }

    // Log trade attempt
    const tradeLog = await supabaseInsert('volume_bot_trades', {
      bot_id: 'main',
      wallet_address: walletAddress,
      trade_type: tradeType,
      sol_amount: solAmount,
      status: 'pending',
    });

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
    if (tradeLog?.[0]?.id) {
      await supabaseUpdate('volume_bot_trades', `id=eq.${tradeLog[0].id}`, {
        status: result.success ? 'success' : 'failed',
        signature: result.signature,
        error_message: result.error,
      });
    }

    return {
      wallet: walletAddress,
      success: result.success,
      tradeType,
      solAmount,
      signature: result.signature,
      error: result.error,
    };
  } catch (error: any) {
    return {
      wallet: walletData.wallet_address,
      success: false,
      error: error.message,
    };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');
    
    if (secret !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = new Connection(RPC_URL, 'confirmed');

    // Get config - direct REST call
    const configs = await supabaseGet('volume_bot_config', 'bot_id=eq.main&select=*');
    const config = configs?.[0];

    if (!config?.is_running) {
      return NextResponse.json({ status: 'not_running' });
    }

    if (!config.token_mint) {
      return NextResponse.json({ error: 'No token configured' }, { status: 400 });
    }

    // Get wallets - direct REST call
    const wallets = await supabaseGet('volume_bot_wallets', 'bot_id=eq.main&select=*');

    // DEBUG - remove this after testing
    return NextResponse.json({
      debug: true,
      timestamp: new Date().toISOString(),
      buildTime: 'Dec11-v4-direct',
      dbWallets: wallets?.map((w: any) => ({
        stored_address: w.wallet_address,
      })),
    });

    if (!wallets || wallets.length === 0) {
      return NextResponse.json({ error: 'No wallets' }, { status: 400 });
    }

    // Check last trade time (respect interval)
    const trades = await supabaseGet('volume_bot_trades', 'bot_id=eq.main&select=created_at&order=created_at.desc&limit=1');
    const lastTrade = trades?.[0];

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

    // Execute trades for ALL wallets simultaneously
    console.log(`🚀 Trading with ${wallets.length} wallets...`);
    
    const tradePromises = wallets.map((w: any) => tradeWithWallet(connection, config, w));
    const results = await Promise.all(tradePromises);

    // Count results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalVolume = successful.reduce((sum, r) => sum + (r.solAmount || 0), 0);

    // Send summary notification
    if (successful.length > 0) {
      const buys = successful.filter(r => r.tradeType === 'buy').length;
      const sells = successful.filter(r => r.tradeType === 'sell').length;
      
      await sendTelegramMessage(
        `⚡ <b>Batch Trade</b>\n` +
        `✅ ${successful.length}/${results.length} success\n` +
        `🟢 ${buys} buys | 🔴 ${sells} sells\n` +
        `💰 ${totalVolume.toFixed(4)} SOL volume`
      );
    }

    return NextResponse.json({
      status: 'completed',
      total_wallets: wallets.length,
      successful: successful.length,
      failed: failed.length,
      total_volume: totalVolume,
      results,
    });
  } catch (error: any) {
    console.error('Trade error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}