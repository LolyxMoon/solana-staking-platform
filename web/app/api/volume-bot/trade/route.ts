import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
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

// Auto-drain threshold - if ANY wallet falls below this, drain ALL wallets
const AUTO_DRAIN_THRESHOLD = 0.03 * LAMPORTS_PER_SOL;

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

// Get token balance using getParsedTokenAccountsByOwner - more reliable
async function getTokenBalance(connection: Connection, wallet: PublicKey, tokenMint: string): Promise<number> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      wallet,
      { mint: new PublicKey(tokenMint) }
    );
    
    if (tokenAccounts.value.length === 0) {
      return 0;
    }
    
    const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.amount;
    return Number(balance);
  } catch (err) {
    console.error('Error getting token balance:', err);
    return 0;
  }
}

// Drain a single wallet - sell all tokens to SOL
async function drainWallet(
  connection: Connection,
  wallet: Keypair,
  tokenMint: string,
  slippageBps: number
): Promise<{ success: boolean; tokensold: number; error?: string }> {
  try {
    const tokenBalance = await getTokenBalance(connection, wallet.publicKey, tokenMint);
    
    if (tokenBalance < 1000) {
      // No tokens to drain
      return { success: true, tokensold: 0 };
    }

    console.log(`🔄 Draining wallet ${wallet.publicKey.toString().slice(0,8)}: ${tokenBalance} tokens`);

    const orderParams = new URLSearchParams({
      inputMint: tokenMint,
      outputMint: SOL_MINT,
      amount: tokenBalance.toString(),
      taker: wallet.publicKey.toString(),
      slippageBps: slippageBps.toString(),
    });

    const orderRes = await fetch(`${JUPITER_ULTRA_API}?${orderParams}`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
    });

    if (!orderRes.ok) {
      const errorText = await orderRes.text();
      return { success: false, tokensold: 0, error: `Order failed: ${errorText}` };
    }

    const orderData = await orderRes.json();
    
    if (orderData.error || !orderData.transaction) {
      return { success: false, tokensold: 0, error: orderData.error || 'No transaction' };
    }

    const transactionBuf = Buffer.from(orderData.transaction, 'base64');
    const transaction = VersionedTransaction.deserialize(transactionBuf);
    transaction.sign([wallet]);

    const signature = await connection.sendRawTransaction(transaction.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    // Wait for confirmation
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    }, 'confirmed');

    console.log(`✅ Drained ${tokenBalance} tokens from ${wallet.publicKey.toString().slice(0,8)}`);
    return { success: true, tokensold: tokenBalance };
  } catch (error: any) {
    console.error('Drain error:', error);
    return { success: false, tokensold: 0, error: error.message };
  }
}

// Drain ALL wallets - sell all tokens to SOL
async function drainAllWallets(
  connection: Connection,
  wallets: any[],
  tokenMint: string,
  slippageBps: number
): Promise<{ drained: number; totalTokens: number }> {
  console.log(`🚨 AUTO-DRAIN: Draining all ${wallets.length} wallets...`);
  
  let drained = 0;
  let totalTokens = 0;

  // Drain sequentially to avoid rate limits
  for (const w of wallets) {
    try {
      const wallet = Keypair.fromSecretKey(parsePrivateKey(w.private_key_encrypted));
      const result = await drainWallet(connection, wallet, tokenMint, slippageBps);
      
      if (result.success && result.tokensold > 0) {
        drained++;
        totalTokens += result.tokensold;
      }
      
      // Small delay between drains
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.error('Drain wallet error:', err);
    }
  }

  return { drained, totalTokens };
}

// Check if any wallet is below threshold
async function checkWalletBalances(
  connection: Connection,
  wallets: any[]
): Promise<{ belowThreshold: boolean; lowWallets: string[] }> {
  const lowWallets: string[] = [];
  
  for (const w of wallets) {
    try {
      const pubkey = new PublicKey(w.wallet_address);
      const balance = await connection.getBalance(pubkey);
      
      if (balance < AUTO_DRAIN_THRESHOLD) {
        lowWallets.push(w.wallet_address.slice(0, 8));
      }
    } catch {}
  }

  return {
    belowThreshold: lowWallets.length > 0,
    lowWallets,
  };
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

    // Check SOL balance
    const solBalance = await connection.getBalance(wallet.publicKey);
    
    // Check token balance using reliable method
    const tokenBalance = await getTokenBalance(connection, wallet.publicKey, config.token_mint);
    
    console.log(`Wallet ${walletAddress.slice(0,8)}: SOL=${solBalance/LAMPORTS_PER_SOL}, Token=${tokenBalance}`);

    // Skip if below minimum SOL needed for any trade
    const MIN_SOL_FOR_TRADE = 0.005 * LAMPORTS_PER_SOL;
    if (solBalance < MIN_SOL_FOR_TRADE) {
      return { 
        wallet: walletAddress, 
        success: false, 
        error: 'insufficient_sol' 
      };
    }

    // Always BUY - we handle sells via auto-drain
    const tradeType = 'buy';
    const solAmount = randomBetween(config.min_sol_amount, config.max_sol_amount);
    
    // Cap buy amount to available SOL minus fees
    const maxAffordable = Math.max(0, (solBalance / LAMPORTS_PER_SOL) - 0.003);
    const cappedAmount = Math.min(solAmount, maxAffordable);
    const amount = Math.floor(cappedAmount * LAMPORTS_PER_SOL);

    if (amount < 0.001 * LAMPORTS_PER_SOL) {
      return { 
        wallet: walletAddress, 
        success: false, 
        error: 'amount_too_small' 
      };
    }

    // Log trade attempt
    const tradeLog = await supabaseInsert('volume_bot_trades', {
      bot_id: 'main',
      wallet_address: walletAddress,
      trade_type: tradeType,
      sol_amount: cappedAmount,
      status: 'pending',
    });

    // Execute swap - always buy
    const result = await executeSwap(
      connection,
      wallet,
      SOL_MINT,
      config.token_mint,
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
      solAmount: cappedAmount,
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

    // ========== PRE-TRADE: Check if any wallet needs drain ==========
    const preCheck = await checkWalletBalances(connection, wallets);
    let preDrainResult = null;
    
    if (preCheck.belowThreshold) {
      console.log(`⚠️ PRE-TRADE: Wallets below threshold: ${preCheck.lowWallets.join(', ')}`);
      
      // Drain all wallets first
      preDrainResult = await drainAllWallets(
        connection,
        wallets,
        config.token_mint,
        config.slippage_bps || 1000 // Higher slippage for drain
      );

      if (preDrainResult.drained > 0) {
        await sendTelegramMessage(
          `🔄 <b>PRE-DRAIN</b>\n` +
          `Low SOL wallets: ${preCheck.lowWallets.join(', ')}\n` +
          `Drained ${preDrainResult.drained} wallets\n` +
          `Tokens sold: ${preDrainResult.totalTokens.toLocaleString()}`
        );
      }

      // Small delay after drain
      await new Promise(r => setTimeout(r, 2000));
    }

    // ========== EXECUTE TRADES ==========
    console.log(`🚀 Trading with ${wallets.length} wallets...`);
    
    const tradePromises = wallets.map((w: any) => tradeWithWallet(connection, config, w));
    const results = await Promise.all(tradePromises);

    // Count results
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    const totalVolume = successful.reduce((sum, r) => sum + (r.solAmount || 0), 0);

    // ========== POST-TRADE: Check balances and auto-drain if needed ==========
    const postCheck = await checkWalletBalances(connection, wallets);
    let postDrainResult = null;

    if (postCheck.belowThreshold) {
      console.log(`⚠️ POST-TRADE: Wallets below threshold: ${postCheck.lowWallets.join(', ')}`);
      
      // Drain ALL wallets to ensure everyone has SOL
      postDrainResult = await drainAllWallets(
        connection,
        wallets,
        config.token_mint,
        config.slippage_bps || 1000 // Higher slippage for drain
      );

      if (postDrainResult.drained > 0) {
        await sendTelegramMessage(
          `🚨 <b>AUTO-DRAIN TRIGGERED</b>\n` +
          `Low SOL wallets: ${postCheck.lowWallets.join(', ')}\n` +
          `Drained ${postDrainResult.drained} wallets\n` +
          `Tokens sold: ${postDrainResult.totalTokens.toLocaleString()}`
        );
      }
    }

    // Send summary notification
    if (successful.length > 0 || preDrainResult || postDrainResult) {
      let msg = `⚡ <b>Volume Bot</b>\n`;
      msg += `✅ ${successful.length}/${results.length} trades\n`;
      msg += `💰 ${totalVolume.toFixed(4)} SOL volume`;
      
      if (preDrainResult?.drained) {
        msg += `\n🔄 Pre-drain: ${preDrainResult.drained} wallets`;
      }
      if (postDrainResult?.drained) {
        msg += `\n🚨 Post-drain: ${postDrainResult.drained} wallets`;
      }
      
      await sendTelegramMessage(msg);
    }

    return NextResponse.json({
      status: 'completed',
      total_wallets: wallets.length,
      successful: successful.length,
      failed: failed.length,
      total_volume: totalVolume,
      pre_drain: preDrainResult,
      post_drain: postDrainResult,
      results,
    });
  } catch (error: any) {
    console.error('Trade error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}