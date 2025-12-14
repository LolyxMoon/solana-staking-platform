import { NextRequest, NextResponse } from 'next/server';
import {
  Connection,
  Keypair,
  PublicKey,
  VersionedTransaction,
  Transaction,
  SystemProgram,
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
const MASTER_KEY = process.env.VOLUME_BOT_MASTER_KEY!;

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const JUPITER_ULTRA_API = 'https://lite-api.jup.ag/ultra/v1/order';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

// Cycle settings
const TOTAL_WALLETS = 20;
const CYCLE_DURATION_MINUTES = 15;
const DRAIN_AFTER_MINUTES = 1;
const MIN_SOL_RESERVE = 0.005; // Keep in master for fees

// Direct REST API calls
async function supabaseGet(table: string, query: string = '') {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Cache-Control': 'no-cache',
    },
    cache: 'no-store',
  });
  return res.json();
}

async function supabaseInsert(table: string, data: any) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function supabaseUpdate(table: string, query: string, data: any) {
  await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
}

async function sendTelegram(text: string) {
  if (!BOT_TOKEN || !ADMIN_CHAT_ID) return;
  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: ADMIN_CHAT_ID,
        text,
        parse_mode: 'HTML',
      }),
    });
  } catch {}
}

async function getTokenBalance(connection: Connection, wallet: PublicKey, tokenMint: string): Promise<number> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet, { mint: new PublicKey(tokenMint) });
    if (tokenAccounts.value.length === 0) return 0;
    return Number(tokenAccounts.value[0].account.data.parsed.info.tokenAmount.amount);
  } catch {
    return 0;
  }
}

async function fundWallet(
  connection: Connection,
  masterWallet: Keypair,
  targetAddress: PublicKey,
  amount: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: masterWallet.publicKey,
        toPubkey: targetAddress,
        lamports: amount,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = masterWallet.publicKey;
    tx.sign(masterWallet);

    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature, 'confirmed');

    return { success: true, signature };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function withdrawToMaster(
  connection: Connection,
  wallet: Keypair,
  masterAddress: PublicKey
): Promise<{ success: boolean; amount: number; signature?: string; error?: string }> {
  try {
    const balance = await connection.getBalance(wallet.publicKey);
    const sendAmount = balance - 5000; // Leave minimal for rent

    if (sendAmount <= 0) {
      return { success: true, amount: 0 };
    }

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: masterAddress,
        lamports: sendAmount,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;
    tx.sign(wallet);

    const signature = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(signature, 'confirmed');

    return { success: true, amount: sendAmount / LAMPORTS_PER_SOL, signature };
  } catch (error: any) {
    return { success: false, amount: 0, error: error.message };
  }
}

async function executeBuy(
  connection: Connection,
  wallet: Keypair,
  tokenMint: string,
  solAmount: number,
  slippageBps: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    const amount = Math.floor(solAmount * LAMPORTS_PER_SOL);

    const orderParams = new URLSearchParams({
      inputMint: SOL_MINT,
      outputMint: tokenMint,
      amount: amount.toString(),
      taker: wallet.publicKey.toString(),
      slippageBps: slippageBps.toString(),
    });

    const orderRes = await fetch(`${JUPITER_ULTRA_API}?${orderParams}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!orderRes.ok) {
      return { success: false, error: `Order failed: ${orderRes.status}` };
    }

    const orderData = await orderRes.json();
    if (orderData.error || !orderData.transaction) {
      return { success: false, error: orderData.error || 'No transaction' };
    }

    const tx = VersionedTransaction.deserialize(Buffer.from(orderData.transaction, 'base64'));
    tx.sign([wallet]);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

    return { success: true, signature };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

async function executeSell(
  connection: Connection,
  wallet: Keypair,
  tokenMint: string,
  tokenAmount: number,
  slippageBps: number
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    if (tokenAmount < 1000) {
      return { success: true }; // Nothing to sell
    }

    const orderParams = new URLSearchParams({
      inputMint: tokenMint,
      outputMint: SOL_MINT,
      amount: tokenAmount.toString(),
      taker: wallet.publicKey.toString(),
      slippageBps: slippageBps.toString(),
    });

    const orderRes = await fetch(`${JUPITER_ULTRA_API}?${orderParams}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!orderRes.ok) {
      return { success: false, error: `Order failed: ${orderRes.status}` };
    }

    const orderData = await orderRes.json();
    if (orderData.error || !orderData.transaction) {
      return { success: false, error: orderData.error || 'No transaction' };
    }

    const tx = VersionedTransaction.deserialize(Buffer.from(orderData.transaction, 'base64'));
    tx.sign([wallet]);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, 'confirmed');

    return { success: true, signature };
  } catch (error: any) {
    return { success: false, error: error.message };
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
    const masterWallet = Keypair.fromSecretKey(parsePrivateKey(MASTER_KEY));

    // Get config
    const configs = await supabaseGet('volume_bot_config', 'bot_id=eq.main&select=*');
    const config = configs?.[0];

    if (!config?.is_running) {
      return NextResponse.json({ status: 'not_running' });
    }

    if (!config.token_mint) {
      return NextResponse.json({ error: 'No token configured' }, { status: 400 });
    }

    // Get wallets (sorted by created order)
    const wallets = await supabaseGet('volume_bot_wallets', 'bot_id=eq.main&select=*&order=created_at.asc');

    if (!wallets || wallets.length < TOTAL_WALLETS) {
      return NextResponse.json({ 
        error: `Need ${TOTAL_WALLETS} wallets, have ${wallets?.length || 0}. Use /wallets ${TOTAL_WALLETS}` 
      }, { status: 400 });
    }

    // Get master wallet balance
    const masterBalance = await connection.getBalance(masterWallet.publicKey);
    const masterSol = masterBalance / LAMPORTS_PER_SOL;

    // Determine cycle state
    const currentIndex = config.current_wallet_index || 0;
    const cyclePhase = config.cycle_phase || 'idle';
    const cycleStartedAt = config.cycle_started_at ? new Date(config.cycle_started_at).getTime() : 0;
    const now = Date.now();
    const minutesIntoCycle = cycleStartedAt ? (now - cycleStartedAt) / 60000 : 999;

    console.log(`📊 State: wallet=${currentIndex}, phase=${cyclePhase}, minutes=${minutesIntoCycle.toFixed(1)}, master=${masterSol.toFixed(4)} SOL`);

    const currentWalletData = wallets[currentIndex];
    const currentWallet = Keypair.fromSecretKey(parsePrivateKey(currentWalletData.private_key_encrypted));

    let result: any = {
      status: 'ok',
      wallet_index: currentIndex,
      phase: cyclePhase,
      master_balance: masterSol,
    };

    // ========== PHASE LOGIC ==========

    if (cyclePhase === 'idle' || cyclePhase === 'waiting' && minutesIntoCycle >= CYCLE_DURATION_MINUTES) {
      // START NEW CYCLE - Fund wallet and buy
      const nextIndex = cyclePhase === 'waiting' ? (currentIndex + 1) % TOTAL_WALLETS : currentIndex;
      const nextWalletData = wallets[nextIndex];
      const nextWallet = Keypair.fromSecretKey(parsePrivateKey(nextWalletData.private_key_encrypted));

      // Calculate funding amount (leave reserve in master)
      const fundAmount = Math.floor((masterBalance - MIN_SOL_RESERVE * LAMPORTS_PER_SOL) * 0.99); // 99% to account for fees

      if (fundAmount < 0.01 * LAMPORTS_PER_SOL) {
        await sendTelegram(`⚠️ Master wallet low!\nBalance: ${masterSol.toFixed(4)} SOL\nNeed more SOL to continue.`);
        return NextResponse.json({ status: 'insufficient_funds', master_balance: masterSol });
      }

      // Fund the wallet
      console.log(`💸 Funding wallet ${nextIndex} with ${(fundAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      const fundResult = await fundWallet(connection, masterWallet, nextWallet.publicKey, fundAmount);

      if (!fundResult.success) {
        await sendTelegram(`❌ Fund failed: ${fundResult.error}`);
        return NextResponse.json({ status: 'fund_failed', error: fundResult.error });
      }

      // Wait for balance to update
      await new Promise(r => setTimeout(r, 2000));

      // Execute buy
      const walletBalance = await connection.getBalance(nextWallet.publicKey);
      const buyAmount = (walletBalance / LAMPORTS_PER_SOL) - 0.003; // Leave for fees

      console.log(`🟢 BUY: ${buyAmount.toFixed(4)} SOL on wallet ${nextIndex}`);
      const buyResult = await executeBuy(
        connection,
        nextWallet,
        config.token_mint,
        buyAmount,
        config.slippage_bps || 500
      );

      // Update state
      await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', {
        current_wallet_index: nextIndex,
        cycle_phase: 'bought',
        cycle_started_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // Log trade
      await supabaseInsert('volume_bot_trades', {
        bot_id: 'main',
        wallet_address: nextWallet.publicKey.toString(),
        trade_type: 'buy',
        sol_amount: buyAmount,
        status: buyResult.success ? 'success' : 'failed',
        signature: buyResult.signature,
        error_message: buyResult.error,
      });

      const emoji = buyResult.success ? '🟢' : '❌';
      await sendTelegram(
        `${emoji} <b>BUY</b> - Wallet ${nextIndex + 1}/${TOTAL_WALLETS}\n` +
        `💰 ${buyAmount.toFixed(4)} SOL\n` +
        `🏦 Master: ${(masterSol - buyAmount).toFixed(4)} SOL\n` +
        (buyResult.signature ? `<a href="https://solscan.io/tx/${buyResult.signature}">View TX</a>` : buyResult.error || '')
      );

      result = { ...result, action: 'buy', success: buyResult.success, signature: buyResult.signature };

    } else if (cyclePhase === 'bought' && minutesIntoCycle >= DRAIN_AFTER_MINUTES) {
      // DRAIN AND WITHDRAW
      console.log(`🔴 DRAIN & WITHDRAW: wallet ${currentIndex}`);

      // Get token balance and sell
      const tokenBalance = await getTokenBalance(connection, currentWallet.publicKey, config.token_mint);
      
      let sellResult = { success: true, signature: undefined as string | undefined };
      if (tokenBalance > 1000) {
        sellResult = await executeSell(
          connection,
          currentWallet,
          config.token_mint,
          tokenBalance,
          config.slippage_bps || 1000 // Higher slippage for sell
        );

        // Log sell trade
        await supabaseInsert('volume_bot_trades', {
          bot_id: 'main',
          wallet_address: currentWallet.publicKey.toString(),
          trade_type: 'sell',
          sol_amount: 0, // We don't know exact SOL received
          token_amount: tokenBalance,
          status: sellResult.success ? 'success' : 'failed',
          signature: sellResult.signature,
          error_message: sellResult.error,
        });
      }

      // Wait a bit then withdraw
      await new Promise(r => setTimeout(r, 3000));

      // Withdraw SOL back to master
      const withdrawResult = await withdrawToMaster(connection, currentWallet, masterWallet.publicKey);

      // Update state to waiting
      await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', {
        cycle_phase: 'waiting',
        updated_at: new Date().toISOString(),
      });

      // Get new master balance
      const newMasterBalance = await connection.getBalance(masterWallet.publicKey);
      const newMasterSol = newMasterBalance / LAMPORTS_PER_SOL;

      const emoji = sellResult.success && withdrawResult.success ? '🔴' : '⚠️';
      await sendTelegram(
        `${emoji} <b>SELL + WITHDRAW</b> - Wallet ${currentIndex + 1}/${TOTAL_WALLETS}\n` +
        `🪙 Sold: ${tokenBalance.toLocaleString()} tokens\n` +
        `💸 Withdrew: ${withdrawResult.amount.toFixed(4)} SOL\n` +
        `🏦 Master: ${newMasterSol.toFixed(4)} SOL\n` +
        `⏳ Next cycle in ${Math.ceil(CYCLE_DURATION_MINUTES - minutesIntoCycle)} min`
      );

      result = { 
        ...result, 
        action: 'drain_withdraw', 
        tokens_sold: tokenBalance,
        sol_withdrawn: withdrawResult.amount,
        new_master_balance: newMasterSol,
      };

    } else if (cyclePhase === 'waiting') {
      // Still waiting for next cycle
      const remainingMinutes = Math.ceil(CYCLE_DURATION_MINUTES - minutesIntoCycle);
      const nextWalletIndex = (currentIndex + 1) % TOTAL_WALLETS;
      
      result = {
        ...result,
        action: 'waiting',
        minutes_remaining: remainingMinutes,
        next_wallet: nextWalletIndex,
      };

    } else if (cyclePhase === 'bought') {
      // Waiting to drain (within first minute)
      const remainingSeconds = Math.ceil((DRAIN_AFTER_MINUTES - minutesIntoCycle) * 60);
      
      result = {
        ...result,
        action: 'waiting_to_drain',
        seconds_remaining: remainingSeconds,
      };
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Trade error:', error);
    await sendTelegram(`❌ Bot error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}