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

// EXACT same endpoints from original working code
const JUPITER_QUOTE_LITE = 'https://lite-api.jup.ag/swap/v1/quote';
const JUPITER_QUOTE_PRO = 'https://api.jup.ag/swap/v1/quote';
const JUPITER_ULTRA_API = 'https://lite-api.jup.ag/ultra/v1/order';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY!;

// Cycle settings
const TOTAL_WALLETS = 20;
const BUYS_PER_WALLET = 10;  // 10 buys per wallet, 1 per minute
const MIN_SOL_RESERVE = 0.005;

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
    const sendAmount = balance - 5000;

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

// EXACT executeSwap function from original working code
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
        error: `Need ${TOTAL_WALLETS} wallets, have ${wallets?.length || 0}. Use /wallets` 
      }, { status: 400 });
    }

    // Get master wallet balance
    const masterBalance = await connection.getBalance(masterWallet.publicKey);
    const masterSol = masterBalance / LAMPORTS_PER_SOL;

    // Current state
    const currentIndex = config.current_wallet_index || 0;
    const buyCount = config.buy_count || 0;
    const cyclePhase = config.cycle_phase || 'idle';

    console.log(`📊 State: wallet=${currentIndex}, phase=${cyclePhase}, buyCount=${buyCount}, master=${masterSol.toFixed(4)} SOL`);

    const currentWalletData = wallets[currentIndex];
    const currentWallet = Keypair.fromSecretKey(parsePrivateKey(currentWalletData.private_key_encrypted));
    const walletBalance = await connection.getBalance(currentWallet.publicKey);
    const walletSol = walletBalance / LAMPORTS_PER_SOL;

    let result: any = {
      status: 'ok',
      wallet_index: currentIndex,
      phase: cyclePhase,
      buy_count: buyCount,
      master_balance: masterSol,
      wallet_balance: walletSol,
    };

    // ========== PHASE LOGIC ==========

    // PHASE 1: Need to fund wallet (idle or wallet has no SOL)
    if (cyclePhase === 'idle' || (cyclePhase === 'buying' && walletSol < 0.01 && buyCount === 0)) {
      
      if (masterBalance < 0.05 * LAMPORTS_PER_SOL) {
        await sendTelegram(`⚠️ Master wallet low!\nBalance: ${masterSol.toFixed(4)} SOL\nNeed more SOL to continue.`);
        return NextResponse.json({ status: 'insufficient_funds', master_balance: masterSol });
      }

      // Fund wallet with almost all master balance
      const fundAmount = Math.floor((masterBalance - MIN_SOL_RESERVE * LAMPORTS_PER_SOL) * 0.99);

      console.log(`💸 Funding wallet ${currentIndex} with ${(fundAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
      const fundResult = await fundWallet(connection, masterWallet, currentWallet.publicKey, fundAmount);

      if (!fundResult.success) {
        await sendTelegram(`❌ Fund failed: ${fundResult.error}`);
        return NextResponse.json({ status: 'fund_failed', error: fundResult.error });
      }

      // Update state
      await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', {
        cycle_phase: 'buying',
        buy_count: 0,
        updated_at: new Date().toISOString(),
      });

      await sendTelegram(
        `💸 <b>FUNDED</b> - Wallet ${currentIndex + 1}/${TOTAL_WALLETS}\n` +
        `💰 ${(fundAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL\n` +
        `📊 Starting ${BUYS_PER_WALLET} buys...`
      );

      result = { ...result, action: 'funded', amount: fundAmount / LAMPORTS_PER_SOL };
    }

    // PHASE 2: Execute buys (1 per minute, 10 total)
    else if (cyclePhase === 'buying' && buyCount < BUYS_PER_WALLET) {
      
      // Calculate buy amount (divide remaining balance by remaining buys)
      const remainingBuys = BUYS_PER_WALLET - buyCount;
      const currentWalletBal = await connection.getBalance(currentWallet.publicKey);
      
      // Leave some SOL for fees on remaining transactions
      const reserveForFees = 0.003 * LAMPORTS_PER_SOL * remainingBuys;
      const availableForBuy = currentWalletBal - reserveForFees;
      const buyAmount = Math.floor(availableForBuy / remainingBuys);

      if (buyAmount < 0.001 * LAMPORTS_PER_SOL) {
        // Not enough SOL left, skip to drain
        console.log('⚠️ Not enough SOL for buy, skipping to drain');
        await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', {
          buy_count: BUYS_PER_WALLET,
          updated_at: new Date().toISOString(),
        });
        return NextResponse.json({ status: 'skipped_to_drain', reason: 'insufficient_balance' });
      }

      console.log(`🟢 BUY ${buyCount + 1}/${BUYS_PER_WALLET}: ${(buyAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL`);

      const buyResult = await executeSwap(
        connection,
        currentWallet,
        SOL_MINT,
        config.token_mint,
        buyAmount,
        config.slippage_bps || 1000
      );

      // Update buy count
      const newBuyCount = buyCount + 1;
      await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', {
        buy_count: newBuyCount,
        updated_at: new Date().toISOString(),
      });

      // Log trade
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
      await sendTelegram(
        `${emoji} <b>BUY ${newBuyCount}/${BUYS_PER_WALLET}</b> - Wallet ${currentIndex + 1}/${TOTAL_WALLETS}\n` +
        `💰 ${(buyAmount / LAMPORTS_PER_SOL).toFixed(4)} SOL\n` +
        (buyResult.signature ? `<a href="https://solscan.io/tx/${buyResult.signature}">View TX</a>` : buyResult.error || '')
      );

      result = { 
        ...result, 
        action: 'buy', 
        buy_number: newBuyCount,
        sol_amount: buyAmount / LAMPORTS_PER_SOL,
        success: buyResult.success, 
        signature: buyResult.signature,
        error: buyResult.error,
      };
    }

    // PHASE 3: All buys done, drain and withdraw
    else if (cyclePhase === 'buying' && buyCount >= BUYS_PER_WALLET) {
      console.log(`🔴 DRAIN & WITHDRAW: wallet ${currentIndex}`);

      // Get token balance and sell
      const tokenBalance = await getTokenBalance(connection, currentWallet.publicKey, config.token_mint);
      
      let sellResult = { success: true, signature: undefined as string | undefined, error: undefined as string | undefined };
      if (tokenBalance > 1000) {
        console.log(`📤 Selling ${tokenBalance} tokens...`);
        sellResult = await executeSwap(
          connection,
          currentWallet,
          config.token_mint,
          SOL_MINT,
          tokenBalance,
          config.slippage_bps || 1000
        );

        // Log sell trade
        await supabaseInsert('volume_bot_trades', {
          bot_id: 'main',
          wallet_address: currentWallet.publicKey.toString(),
          trade_type: 'sell',
          sol_amount: 0,
          token_amount: tokenBalance,
          status: sellResult.success ? 'success' : 'failed',
          signature: sellResult.signature,
          error_message: sellResult.error,
        });
      }

      // Wait then withdraw
      await new Promise(r => setTimeout(r, 3000));

      // Withdraw SOL back to master
      const withdrawResult = await withdrawToMaster(connection, currentWallet, masterWallet.publicKey);

      // Move to next wallet
      const nextIndex = (currentIndex + 1) % TOTAL_WALLETS;
      
      await supabaseUpdate('volume_bot_config', 'bot_id=eq.main', {
        current_wallet_index: nextIndex,
        cycle_phase: 'idle',
        buy_count: 0,
        updated_at: new Date().toISOString(),
      });

      // Get new master balance
      const newMasterBalance = await connection.getBalance(masterWallet.publicKey);
      const newMasterSol = newMasterBalance / LAMPORTS_PER_SOL;

      const emoji = sellResult.success && withdrawResult.success ? '🔴' : '⚠️';
      await sendTelegram(
        `${emoji} <b>CYCLE COMPLETE</b> - Wallet ${currentIndex + 1}/${TOTAL_WALLETS}\n` +
        `🪙 Sold: ${tokenBalance.toLocaleString()} tokens\n` +
        `💸 Withdrew: ${withdrawResult.amount.toFixed(4)} SOL\n` +
        `🏦 Master: ${newMasterSol.toFixed(4)} SOL\n` +
        `➡️ Next: Wallet ${nextIndex + 1}`
      );

      result = { 
        ...result, 
        action: 'drain_withdraw', 
        tokens_sold: tokenBalance,
        sol_withdrawn: withdrawResult.amount,
        new_master_balance: newMasterSol,
        next_wallet: nextIndex,
        sell_error: sellResult.error,
      };
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Trade error:', error);
    await sendTelegram(`❌ Bot error: ${error.message}`);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}