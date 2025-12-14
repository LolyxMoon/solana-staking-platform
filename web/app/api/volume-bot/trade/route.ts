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
  if (key.startsWith('[')) return new Uint8Array(JSON.parse(key));
  return bs58.decode(key);
}

const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL!;
const CRON_SECRET = process.env.VOLUME_BOT_CRON_SECRET || 'your-secret-key';
const BOT_TOKEN = process.env.VOLUME_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.VOLUME_BOT_ADMIN_CHAT_ID;
const MASTER_KEY = process.env.VOLUME_BOT_MASTER_KEY!;

const SOL_MINT = 'So11111111111111111111111111111111111111112';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const TOTAL_WALLETS = 20;
const BUYS_PER_WALLET = 10;
const MIN_SOL_RESERVE = 0.005;

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
  await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });
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
      body: JSON.stringify({ chat_id: ADMIN_CHAT_ID, text, parse_mode: 'HTML' }),
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

async function fundWallet(connection: Connection, masterWallet: Keypair, targetAddress: PublicKey, amount: number) {
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
  return signature;
}

async function withdrawToMaster(connection: Connection, wallet: Keypair, masterAddress: PublicKey) {
  const balance = await connection.getBalance(wallet.publicKey);
  const sendAmount = balance - 5000;
  if (sendAmount <= 0) return { amount: 0 };

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
  await connection.sendRawTransaction(tx.serialize());
  return { amount: sendAmount / LAMPORTS_PER_SOL };
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

    const quoteRes = await fetch(`https://api.jup.ag/swap/v1/quote?${quoteParams}`);
    if (!quoteRes.ok) return { success: false, error: `Quote failed: ${quoteRes.status}` };

    const quoteData = await quoteRes.json();

    const swapRes = await fetch('https://api.jup.ag/swap/v1/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: wallet.publicKey.toString(),
        wrapAndUnwrapSol: true,
      }),
    });

    if (!swapRes.ok) return { success: false, error: `Swap failed: ${swapRes.status}` };

    const swapData = await swapRes.json();
    const tx = VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, 'base64'));
    tx.sign([wallet]);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 2,
    });

    await connection.confirmTransaction(signature, 'confirmed');
    return { success: true, signature };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    if (searchParams.get('secret') !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = new Connection(RPC_URL, 'confirmed');
    const masterWallet = Keypair.fromSecretKey(parsePrivateKey(MASTER_KEY));

    const configs = await supabaseGet('volume_bot_config', 'bot_id=eq.main&select=*');
    const config = configs?.[0];

    if (!config?.is_running) return NextResponse.json({ status: 'not_running' });
    if (!config.token_mint) return NextResponse.json({ error: 'No token configured' }, { status: 400 });

    const wallets = await supabaseGet('volume_bot_wallets', 'bot_id=eq.main&select=*&order=created_at.asc');
    if (!wallets || wallets.length < TOTAL_WALLETS) {
      return NextResponse.json({ error: `Need ${TOTAL_WALLETS} wallets` }, { status: 400 });
    }

    const masterBalance = await connection.getBalance(masterWallet.publicKey);
    const currentIndex = config.current_wallet_index || 0;
    const cyclePhase = config.cycle_phase || 'idle';
    const botMode = config.bot_mode || 'split_buys';

    const currentWalletData = wallets[currentIndex];
    const currentWallet = Keypair.fromSecretKey(parsePrivateKey(currentWalletData.private_key_encrypted));
    const walletBalance = await connection.getBalance(currentWallet.publicKey);

    console.log(`📊 Mode: ${botMode}, Wallet: ${currentIndex}, Phase: ${cyclePhase}`);

    // ========== SPLIT BUYS MODE ==========
    if (botMode === 'split_buys') {
      const buyCount = config.buy_count || 0;

      // Phase 1: Fund wallet
      if (cyclePhase === 'idle') {
        if (masterBalance < 0.05 * LAMPORTS_PER_SOL) {
          await sendTelegram(`⚠️ Master low: ${(masterBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
          return NextResponse.json({ status: 'insufficient_funds' });
        }

        const fundAmount = Math.floor((masterBalance - MIN_SOL_RESERVE * LAMPORTS_PER_SOL) * 0.99);
        await fundWallet(connection, masterWallet, currentWallet.publicKey, fundAmount);

        await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', {
          cycle_phase: 'buying',
          buy_count: 0,
          updated_at: new Date().toISOString(),
        });

        await sendTelegram(`💸 <b>FUNDED</b> Wallet ${currentIndex + 1}\n💰 ${(fundAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        return NextResponse.json({ action: 'funded' });
      }

      // Phase 2: Execute buys
      if (cyclePhase === 'buying' && buyCount < BUYS_PER_WALLET) {
        const remainingBuys = BUYS_PER_WALLET - buyCount;
        const currentBal = await connection.getBalance(currentWallet.publicKey);
        const reserveForFees = 0.003 * LAMPORTS_PER_SOL * remainingBuys;
        const buyAmount = Math.floor((currentBal - reserveForFees) / remainingBuys);

        if (buyAmount < 0.001 * LAMPORTS_PER_SOL) {
          await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', { buy_count: BUYS_PER_WALLET });
          return NextResponse.json({ status: 'skipped_to_drain' });
        }

        const buyResult = await executeSwap(connection, currentWallet, SOL_MINT, config.token_mint, buyAmount, config.slippage_bps || 1000);

        await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', {
          buy_count: buyCount + 1,
          updated_at: new Date().toISOString(),
        });

        await supabaseInsert('volume_bot_trades', {
          bot_id: 'main',
          wallet_address: currentWallet.publicKey.toString(),
          trade_type: 'buy',
          sol_amount: buyAmount / LAMPORTS_PER_SOL,
          status: buyResult.success ? 'success' : 'failed',
          signature: buyResult.signature,
          error_message: buyResult.error,
        });

        const emoji = buyResult.success ? '🟢' : '❌';
        await sendTelegram(`${emoji} <b>BUY ${buyCount + 1}/${BUYS_PER_WALLET}</b>\n💰 ${(buyAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

        return NextResponse.json({ action: 'buy', buy_number: buyCount + 1, success: buyResult.success });
      }

      // Phase 3: Drain and withdraw
      if (cyclePhase === 'buying' && buyCount >= BUYS_PER_WALLET) {
        const tokenBalance = await getTokenBalance(connection, currentWallet.publicKey, config.token_mint);
        
        if (tokenBalance > 1000) {
          await executeSwap(connection, currentWallet, config.token_mint, SOL_MINT, tokenBalance, config.slippage_bps || 1000);
        }

        await new Promise(r => setTimeout(r, 3000));
        const withdrawResult = await withdrawToMaster(connection, currentWallet, masterWallet.publicKey);

        const nextIndex = (currentIndex + 1) % TOTAL_WALLETS;
        await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', {
          current_wallet_index: nextIndex,
          cycle_phase: 'idle',
          buy_count: 0,
          updated_at: new Date().toISOString(),
        });

        await sendTelegram(`🔴 <b>COMPLETE</b> Wallet ${currentIndex + 1}\n💸 Withdrew: ${withdrawResult.amount.toFixed(4)} SOL\n➡️ Next: Wallet ${nextIndex + 1}`);

        return NextResponse.json({ action: 'drain_withdraw', next_wallet: nextIndex });
      }
    }

    // ========== CUSTOM MODE ==========
    else if (botMode === 'custom') {
      const customBuyAmount = config.custom_buy_amount || 0.5;
      const customDelayMinutes = config.custom_sell_delay_minutes || 5;
      const customBuyTime = config.custom_buy_time ? new Date(config.custom_buy_time) : null;

      // Phase 1: Fund wallet
      if (cyclePhase === 'idle') {
        // Fund with custom buy amount + buffer for fees
        const fundAmountSol = customBuyAmount + 0.01;
        const fundAmountLamports = Math.floor(fundAmountSol * LAMPORTS_PER_SOL);

        if (masterBalance < fundAmountLamports) {
          await sendTelegram(`⚠️ Master low: ${(masterBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\nNeed: ${fundAmountSol} SOL`);
          return NextResponse.json({ status: 'insufficient_funds' });
        }

        await fundWallet(connection, masterWallet, currentWallet.publicKey, fundAmountLamports);

        await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', {
          cycle_phase: 'buying',
          updated_at: new Date().toISOString(),
        });

        await sendTelegram(`💸 <b>FUNDED</b> Wallet ${currentIndex + 1}\n💰 ${fundAmountSol.toFixed(3)} SOL (Custom mode)`);
        return NextResponse.json({ action: 'funded', mode: 'custom' });
      }

      // Phase 2: Execute single buy
      if (cyclePhase === 'buying') {
        const buyAmountLamports = Math.floor(customBuyAmount * LAMPORTS_PER_SOL);

        const buyResult = await executeSwap(connection, currentWallet, SOL_MINT, config.token_mint, buyAmountLamports, config.slippage_bps || 1000);

        await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', {
          cycle_phase: 'waiting',
          custom_buy_time: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

        await supabaseInsert('volume_bot_trades', {
          bot_id: 'main',
          wallet_address: currentWallet.publicKey.toString(),
          trade_type: 'buy',
          sol_amount: customBuyAmount,
          status: buyResult.success ? 'success' : 'failed',
          signature: buyResult.signature,
          error_message: buyResult.error,
        });

        const emoji = buyResult.success ? '🟢' : '❌';
        await sendTelegram(`${emoji} <b>BUY</b> (Custom)\n💰 ${customBuyAmount} SOL\n⏱️ Selling in ${customDelayMinutes} min`);

        return NextResponse.json({ action: 'buy', mode: 'custom', success: buyResult.success });
      }

      // Phase 3: Wait for delay
      if (cyclePhase === 'waiting' && customBuyTime) {
        const elapsedMinutes = (Date.now() - customBuyTime.getTime()) / 60000;

        if (elapsedMinutes < customDelayMinutes) {
          console.log(`⏳ Waiting: ${elapsedMinutes.toFixed(1)}/${customDelayMinutes} min`);
          return NextResponse.json({ 
            status: 'waiting', 
            elapsed: elapsedMinutes.toFixed(1), 
            delay: customDelayMinutes 
          });
        }

        // Time to sell!
        const tokenBalance = await getTokenBalance(connection, currentWallet.publicKey, config.token_mint);
        
        let sellResult = { success: true, signature: undefined as string | undefined };
        if (tokenBalance > 1000) {
          sellResult = await executeSwap(connection, currentWallet, config.token_mint, SOL_MINT, tokenBalance, config.slippage_bps || 1000);

          await supabaseInsert('volume_bot_trades', {
            bot_id: 'main',
            wallet_address: currentWallet.publicKey.toString(),
            trade_type: 'sell',
            token_amount: tokenBalance,
            status: sellResult.success ? 'success' : 'failed',
            signature: sellResult.signature,
          });
        }

        await new Promise(r => setTimeout(r, 3000));
        const withdrawResult = await withdrawToMaster(connection, currentWallet, masterWallet.publicKey);

        const nextIndex = (currentIndex + 1) % TOTAL_WALLETS;
        await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', {
          current_wallet_index: nextIndex,
          cycle_phase: 'idle',
          custom_buy_time: null,
          updated_at: new Date().toISOString(),
        });

        const newMasterBal = await connection.getBalance(masterWallet.publicKey);
        await sendTelegram(
          `🔴 <b>COMPLETE</b> Wallet ${currentIndex + 1}\n` +
          `🪙 Sold: ${tokenBalance.toLocaleString()} tokens\n` +
          `💸 Withdrew: ${withdrawResult.amount.toFixed(4)} SOL\n` +
          `🏦 Master: ${(newMasterBal / LAMPORTS_PER_SOL).toFixed(4)} SOL\n` +
          `➡️ Next: Wallet ${nextIndex + 1}`
        );

        return NextResponse.json({ action: 'sell_withdraw', mode: 'custom', next_wallet: nextIndex });
      }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    console.error('Trade error:', error);
    await sendTelegram(`❌ Bot error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}