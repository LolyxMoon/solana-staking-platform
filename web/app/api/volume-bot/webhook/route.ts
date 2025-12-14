import { NextRequest, NextResponse } from 'next/server';
import { Keypair, PublicKey, Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

export const dynamic = 'force-dynamic';

function parsePrivateKey(key: string): Uint8Array {
  if (key.startsWith('[')) {
    const bytes = JSON.parse(key);
    return new Uint8Array(bytes);
  }
  return bs58.decode(key);
}

const BOT_TOKEN = process.env.VOLUME_BOT_TOKEN!;
const ALLOWED_USER_IDS = process.env.VOLUME_BOT_ALLOWED_IDS?.split(',').map(id => parseInt(id.trim())) || [];
const RPC_URL = process.env.NEXT_PUBLIC_HELIUS_RPC_URL || process.env.NEXT_PUBLIC_RPC_URL || process.env.NEXT_PUBLIC_RPC_ENDPOINT!;
const CRON_SECRET = process.env.VOLUME_BOT_CRON_SECRET || 'your-secret-key';
const MASTER_KEY = process.env.VOLUME_BOT_MASTER_KEY;

const TOTAL_WALLETS = 20;
const CYCLE_DURATION_MINUTES = 15;

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !key) {
    throw new Error(`Missing Supabase config: URL=${!!url}, KEY=${!!key}`);
  }
  
  return createClient(url, key);
}

async function sendMessage(chatId: number, text: string, parseMode: 'HTML' | 'Markdown' = 'HTML') {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: parseMode }),
  });
}

function isAuthorized(userId: number): boolean {
  if (ALLOWED_USER_IDS.length === 0) return true;
  return ALLOWED_USER_IDS.includes(userId);
}

async function getTokenBalance(connection: Connection, wallet: PublicKey, tokenMint: string): Promise<{ amount: number; rawAmount: number }> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(wallet, { mint: new PublicKey(tokenMint) });
    if (tokenAccounts.value.length === 0) return { amount: 0, rawAmount: 0 };
    const info = tokenAccounts.value[0].account.data.parsed.info;
    const rawAmount = Number(info.tokenAmount.amount);
    const decimals = info.tokenAmount.decimals;
    return { amount: rawAmount / Math.pow(10, decimals), rawAmount };
  } catch {
    return { amount: 0, rawAmount: 0 };
  }
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();
    const message = update.message;
    
    if (!message?.text) return NextResponse.json({ ok: true });
    
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text.trim();
    
    if (!isAuthorized(userId)) {
      await sendMessage(chatId, '❌ Unauthorized');
      return NextResponse.json({ ok: true });
    }

    const supabase = getSupabase();
    const connection = new Connection(RPC_URL, 'confirmed');
    const [command, ...args] = text.split(' ');

    switch (command.toLowerCase()) {
      case '/start':
      case '/help': {
        await sendMessage(chatId, `
🤖 <b>Volume Bot v2 - Sequential Cycling</b>

<b>How it works:</b>
• 20 wallets rotate every ${CYCLE_DURATION_MINUTES} minutes
• Full master balance → wallet → buy → sell → return
• Automatic cycling through all wallets

<b>Setup:</b>
/token &lt;mint&gt; - Set token (SPT)
/wallets - Generate ${TOTAL_WALLETS} fresh wallets
/slippage &lt;bps&gt; - Set slippage (default 500)

<b>Control:</b>
/run - Start cycling
/stop - Stop bot
/reset - Reset to wallet 1

<b>Monitor:</b>
/status - Full bot status
/master - Master wallet balance
/cycle - Current cycle info
/balances - All wallet balances

<b>Recovery:</b>
/drainall - Sell all tokens in all wallets
/withdrawall - Return all SOL to master
/export - Export wallet keys

<b>Info:</b>
/cron - Get cron URL
/stats - Trading stats
        `);
        break;
      }

      case '/token': {
        if (!args[0]) {
          await sendMessage(chatId, '❌ Usage: /token <mint_address>');
          break;
        }
        
        const mint = args[0];
        try { new PublicKey(mint); } catch {
          await sendMessage(chatId, '❌ Invalid mint address');
          break;
        }

        let symbol = 'TOKEN';
        let decimals = 9;
        try {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
          const data = await res.json();
          if (data.pairs?.[0]?.baseToken) symbol = data.pairs[0].baseToken.symbol;
          
          const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mint));
          if (mintInfo.value?.data && typeof mintInfo.value.data === 'object') {
            decimals = (mintInfo.value.data as any).parsed?.info?.decimals || 9;
          }
        } catch {}

        await supabase
          .from('volume_bot_config')
          .update({ 
            token_mint: mint, 
            token_symbol: symbol,
            token_decimals: decimals,
            updated_at: new Date().toISOString() 
          })
          .eq('bot_id', 'main');

        await sendMessage(chatId, `✅ Token set!\n\n<b>Mint:</b> <code>${mint}</code>\n<b>Symbol:</b> ${symbol}\n<b>Decimals:</b> ${decimals}`);
        break;
      }

      case '/wallets': {
        // Check for existing wallets with funds
        const { data: existingWallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address, private_key_encrypted')
          .eq('bot_id', 'main');

        if (existingWallets && existingWallets.length > 0) {
          let totalSol = 0;
          for (const w of existingWallets) {
            try {
              const balance = await connection.getBalance(new PublicKey(w.wallet_address));
              totalSol += balance / LAMPORTS_PER_SOL;
            } catch {}
          }

          if (totalSol > 0.001) {
            await sendMessage(chatId, `
⚠️ <b>Existing wallets have ${totalSol.toFixed(4)} SOL!</b>

Run these first:
1. /drainall - Sell all tokens
2. /withdrawall - Return SOL to master
3. /wallets_confirm - Then create new wallets

Or /export to save current keys.
            `);
            break;
          }
        }

        await createNewWallets(supabase, chatId, TOTAL_WALLETS);
        break;
      }

      case '/wallets_confirm': {
        await createNewWallets(supabase, chatId, TOTAL_WALLETS);
        break;
      }

      case '/master': {
        if (!MASTER_KEY) {
          await sendMessage(chatId, '❌ VOLUME_BOT_MASTER_KEY not set');
          break;
        }

        const masterWallet = Keypair.fromSecretKey(parsePrivateKey(MASTER_KEY));
        const balance = await connection.getBalance(masterWallet.publicKey);
        
        await sendMessage(chatId, `
🏦 <b>Master Wallet</b>

<b>Address:</b> <code>${masterWallet.publicKey.toString()}</code>
<b>Balance:</b> ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL

<a href="https://solscan.io/account/${masterWallet.publicKey.toString()}">View on Solscan</a>
        `);
        break;
      }

      case '/cycle': {
        const { data: config } = await supabase
          .from('volume_bot_config')
          .select('*')
          .eq('bot_id', 'main')
          .single();

        const currentIndex = config?.current_wallet_index || 0;
        const phase = config?.cycle_phase || 'idle';
        const cycleStarted = config?.cycle_started_at ? new Date(config.cycle_started_at) : null;
        
        let timeInfo = '';
        if (cycleStarted) {
          const minutesIn = (Date.now() - cycleStarted.getTime()) / 60000;
          const remaining = CYCLE_DURATION_MINUTES - minutesIn;
          timeInfo = `\n<b>Time in cycle:</b> ${minutesIn.toFixed(1)} min\n<b>Next wallet in:</b> ${Math.max(0, remaining).toFixed(1)} min`;
        }

        await sendMessage(chatId, `
🔄 <b>Current Cycle</b>

<b>Wallet:</b> ${currentIndex + 1} of ${TOTAL_WALLETS}
<b>Phase:</b> ${phase}
<b>Status:</b> ${config?.is_running ? '🟢 Running' : '🔴 Stopped'}${timeInfo}
        `);
        break;
      }

      case '/reset': {
        await supabase
          .from('volume_bot_config')
          .update({
            current_wallet_index: 0,
            cycle_phase: 'idle',
            cycle_started_at: null,
            updated_at: new Date().toISOString()
          })
          .eq('bot_id', 'main');

        await sendMessage(chatId, '✅ Reset to wallet 1. Use /run to start fresh.');
        break;
      }

      case '/slippage': {
        const bps = parseInt(args[0]);
        if (!bps || bps < 50 || bps > 5000) {
          await sendMessage(chatId, '❌ Usage: /slippage <bps> (50-5000)');
          break;
        }

        await supabase
          .from('volume_bot_config')
          .update({ slippage_bps: bps, updated_at: new Date().toISOString() })
          .eq('bot_id', 'main');

        await sendMessage(chatId, `✅ Slippage set to ${bps} bps (${bps / 100}%)`);
        break;
      }

      case '/run': {
        const { data: config } = await supabase
          .from('volume_bot_config')
          .select('*')
          .eq('bot_id', 'main')
          .single();

        if (!config?.token_mint) {
          await sendMessage(chatId, '❌ Set token first with /token');
          break;
        }

        const { data: wallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address')
          .eq('bot_id', 'main');

        if (!wallets || wallets.length < TOTAL_WALLETS) {
          await sendMessage(chatId, `❌ Need ${TOTAL_WALLETS} wallets. Use /wallets to generate.`);
          break;
        }

        if (!MASTER_KEY) {
          await sendMessage(chatId, '❌ VOLUME_BOT_MASTER_KEY not set');
          break;
        }

        const masterWallet = Keypair.fromSecretKey(parsePrivateKey(MASTER_KEY));
        const masterBalance = await connection.getBalance(masterWallet.publicKey);

        await supabase
          .from('volume_bot_config')
          .update({ 
            is_running: true,
            cycle_phase: 'idle', // Will start fresh on next cron
            updated_at: new Date().toISOString()
          })
          .eq('bot_id', 'main');

        await sendMessage(chatId, `
🚀 <b>Bot Started!</b>

<b>Token:</b> ${config.token_symbol}
<b>Wallets:</b> ${wallets.length}
<b>Cycle:</b> ${CYCLE_DURATION_MINUTES} minutes
<b>Master Balance:</b> ${(masterBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL
<b>Slippage:</b> ${config.slippage_bps || 500} bps

Bot will cycle through all wallets automatically.
Use /cycle to monitor progress.
        `);
        break;
      }

      case '/stop': {
        await supabase
          .from('volume_bot_config')
          .update({ is_running: false, updated_at: new Date().toISOString() })
          .eq('bot_id', 'main');

        await sendMessage(chatId, '⏹ Bot stopped. Use /run to resume.');
        break;
      }

      case '/status': {
        const { data: config } = await supabase
          .from('volume_bot_config')
          .select('*')
          .eq('bot_id', 'main')
          .single();

        const { data: wallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address')
          .eq('bot_id', 'main');

        let masterBalance = 0;
        if (MASTER_KEY) {
          const masterWallet = Keypair.fromSecretKey(parsePrivateKey(MASTER_KEY));
          masterBalance = await connection.getBalance(masterWallet.publicKey);
        }

        const status = config?.is_running ? '🟢 Running' : '🔴 Stopped';
        const currentWallet = (config?.current_wallet_index || 0) + 1;
        
        await sendMessage(chatId, `
📊 <b>Volume Bot Status</b>

<b>Status:</b> ${status}
<b>Token:</b> ${config?.token_symbol || 'Not set'}
<b>Mint:</b> <code>${config?.token_mint || 'Not set'}</code>

<b>Wallets:</b> ${wallets?.length || 0}/${TOTAL_WALLETS}
<b>Current:</b> Wallet ${currentWallet}
<b>Phase:</b> ${config?.cycle_phase || 'idle'}

<b>Master Balance:</b> ${(masterBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL
<b>Slippage:</b> ${config?.slippage_bps || 500} bps
<b>Cycle Duration:</b> ${CYCLE_DURATION_MINUTES} min
        `);
        break;
      }

      case '/balances': {
        const { data: wallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address')
          .eq('bot_id', 'main')
          .order('created_at', { ascending: true });

        const { data: config } = await supabase
          .from('volume_bot_config')
          .select('token_mint, token_symbol, current_wallet_index')
          .eq('bot_id', 'main')
          .single();

        if (!wallets || wallets.length === 0) {
          await sendMessage(chatId, '❌ No wallets');
          break;
        }

        await sendMessage(chatId, '⏳ Checking balances...');

        let balanceText = '<b>Wallet Balances</b>\n\n';
        let totalSol = 0;
        let totalToken = 0;
        const currentIndex = config?.current_wallet_index || 0;

        for (let i = 0; i < wallets.length; i++) {
          const w = wallets[i];
          try {
            const pubkey = new PublicKey(w.wallet_address);
            const solBalance = await connection.getBalance(pubkey);
            const solAmount = solBalance / LAMPORTS_PER_SOL;
            totalSol += solAmount;

            let tokenAmount = 0;
            if (config?.token_mint) {
              const { amount } = await getTokenBalance(connection, pubkey, config.token_mint);
              tokenAmount = amount;
              totalToken += tokenAmount;
            }

            const marker = i === currentIndex ? '👉 ' : '';
            balanceText += `${marker}<b>${i + 1}.</b> ${solAmount.toFixed(4)} SOL`;
            if (tokenAmount > 0) balanceText += ` | ${tokenAmount.toLocaleString()} ${config.token_symbol}`;
            balanceText += '\n';
          } catch {}
        }

        // Add master balance
        if (MASTER_KEY) {
          const masterWallet = Keypair.fromSecretKey(parsePrivateKey(MASTER_KEY));
          const masterBal = await connection.getBalance(masterWallet.publicKey);
          balanceText += `\n🏦 <b>Master:</b> ${(masterBal / LAMPORTS_PER_SOL).toFixed(4)} SOL`;
        }

        balanceText += `\n\n<b>Total in wallets:</b> ${totalSol.toFixed(4)} SOL`;
        if (totalToken > 0) balanceText += ` | ${totalToken.toLocaleString()} ${config?.token_symbol}`;

        await sendMessage(chatId, balanceText);
        break;
      }

      case '/drainall': {
        const { data: wallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address, private_key_encrypted')
          .eq('bot_id', 'main');

        const { data: config } = await supabase
          .from('volume_bot_config')
          .select('token_mint, slippage_bps')
          .eq('bot_id', 'main')
          .single();

        if (!wallets || wallets.length === 0) {
          await sendMessage(chatId, '❌ No wallets');
          break;
        }

        if (!config?.token_mint) {
          await sendMessage(chatId, '❌ No token configured');
          break;
        }

        await sendMessage(chatId, `⏳ Draining tokens from ${wallets.length} wallets...`);

        let drained = 0;
        let totalTokens = 0;
        const { VersionedTransaction } = await import('@solana/web3.js');

        for (const w of wallets) {
          try {
            const wallet = Keypair.fromSecretKey(parsePrivateKey(w.private_key_encrypted));
            const { rawAmount } = await getTokenBalance(connection, wallet.publicKey, config.token_mint);

            if (rawAmount < 1000) continue;

            const params = new URLSearchParams({
              inputMint: config.token_mint,
              outputMint: 'So11111111111111111111111111111111111111112',
              amount: rawAmount.toString(),
              taker: wallet.publicKey.toString(),
              slippageBps: (config.slippage_bps || 1000).toString(),
            });

            const orderRes = await fetch(`https://lite-api.jup.ag/ultra/v1/order?${params}`, {
              headers: { 'Accept': 'application/json' },
            });

            if (!orderRes.ok) continue;

            const orderData = await orderRes.json();
            if (!orderData.transaction) continue;

            const tx = VersionedTransaction.deserialize(Buffer.from(orderData.transaction, 'base64'));
            tx.sign([wallet]);

            await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
            drained++;
            totalTokens += rawAmount;

            await new Promise(r => setTimeout(r, 500));
          } catch (err) {
            console.error('Drain error:', err);
          }
        }

        await sendMessage(chatId, `✅ Drained ${drained} wallets\n💰 ~${totalTokens.toLocaleString()} tokens sold`);
        break;
      }

      case '/withdrawall': {
        if (!MASTER_KEY) {
          await sendMessage(chatId, '❌ VOLUME_BOT_MASTER_KEY not set');
          break;
        }

        const masterWallet = Keypair.fromSecretKey(parsePrivateKey(MASTER_KEY));

        const { data: wallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address, private_key_encrypted')
          .eq('bot_id', 'main');

        if (!wallets || wallets.length === 0) {
          await sendMessage(chatId, '❌ No wallets');
          break;
        }

        await sendMessage(chatId, `⏳ Withdrawing SOL from ${wallets.length} wallets...`);

        const { Transaction, SystemProgram } = await import('@solana/web3.js');
        let withdrawn = 0;
        let totalSol = 0;

        for (const w of wallets) {
          try {
            const wallet = Keypair.fromSecretKey(parsePrivateKey(w.private_key_encrypted));
            const balance = await connection.getBalance(wallet.publicKey);
            
            const sendAmount = balance - 5000;
            if (sendAmount <= 0) continue;

            const tx = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: masterWallet.publicKey,
                lamports: sendAmount,
              })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;
            tx.sign(wallet);

            await connection.sendRawTransaction(tx.serialize());
            withdrawn++;
            totalSol += sendAmount / LAMPORTS_PER_SOL;

            await new Promise(r => setTimeout(r, 200));
          } catch (err) {
            console.error('Withdraw error:', err);
          }
        }

        const newMasterBalance = await connection.getBalance(masterWallet.publicKey);
        await sendMessage(chatId, `✅ Withdrew from ${withdrawn} wallets\n💰 ~${totalSol.toFixed(4)} SOL\n🏦 Master now: ${(newMasterBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
        break;
      }

      case '/export': {
        const { data: wallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address, private_key_encrypted')
          .eq('bot_id', 'main')
          .order('created_at', { ascending: true });

        if (!wallets || wallets.length === 0) {
          await sendMessage(chatId, '❌ No wallets');
          break;
        }

        let exportText = '🔐 <b>Wallet Export</b>\n\n⚠️ Keep these secret!\n\n';
        for (let i = 0; i < wallets.length; i++) {
          exportText += `<b>${i + 1}.</b> <code>${wallets[i].wallet_address}</code>\n<code>${wallets[i].private_key_encrypted}</code>\n\n`;
        }

        await sendMessage(chatId, exportText);
        break;
      }

      case '/stats': {
        const { data: trades } = await supabase
          .from('volume_bot_trades')
          .select('trade_type, sol_amount, status, created_at')
          .eq('bot_id', 'main')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!trades || trades.length === 0) {
          await sendMessage(chatId, '📊 No trades yet');
          break;
        }

        const successful = trades.filter(t => t.status === 'success');
        const buys = successful.filter(t => t.trade_type === 'buy');
        const sells = successful.filter(t => t.trade_type === 'sell');
        const errors = trades.filter(t => t.status === 'failed');
        const totalVolume = buys.reduce((sum, t) => sum + (t.sol_amount || 0), 0);

        await sendMessage(chatId, `
📊 <b>Trading Stats</b>

<b>Total Trades:</b> ${successful.length}
<b>Buys:</b> ${buys.length}
<b>Sells:</b> ${sells.length}
<b>Errors:</b> ${errors.length}
<b>Buy Volume:</b> ${totalVolume.toFixed(4)} SOL

<b>Last Trade:</b> ${trades[0] ? new Date(trades[0].created_at).toLocaleString() : 'N/A'}
        `);
        break;
      }

      case '/cron': {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://stakepoint.app';
        await sendMessage(chatId, `
🔄 <b>Cron Setup</b>

Add this URL to cron-job.org (<b>every 1 minute</b>):

<code>${baseUrl}/api/volume-bot/trade?secret=${CRON_SECRET}</code>

Method: GET
Interval: Every 1 minute
        `);
        break;
      }

      default: {
        await sendMessage(chatId, '❓ Unknown command. Use /help');
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ ok: true });
  }
}

async function createNewWallets(supabase: any, chatId: number, count: number) {
  const wallets: { address: string; privateKey: string }[] = [];
  for (let i = 0; i < count; i++) {
    const kp = Keypair.generate();
    wallets.push({
      address: kp.publicKey.toString(),
      privateKey: bs58.encode(kp.secretKey),
    });
  }

  // Clear old wallets
  const { error: deleteError } = await supabase
    .from('volume_bot_wallets')
    .delete()
    .eq('bot_id', 'main');

  if (deleteError) {
    await sendMessage(chatId, `❌ Failed to clear old wallets: ${deleteError.message}`);
    return;
  }

  // Batch insert all wallets
  const walletRows = wallets.map(w => ({
    bot_id: 'main',
    wallet_address: w.address,
    private_key_encrypted: w.privateKey,
  }));

  const { error: insertError } = await supabase
    .from('volume_bot_wallets')
    .insert(walletRows);

  if (insertError) {
    await sendMessage(chatId, `❌ Failed to save wallets: ${insertError.message}`);
    return;
  }

  // Reset cycle state
  await supabase
    .from('volume_bot_config')
    .update({
      current_wallet_index: 0,
      cycle_phase: 'idle',
      cycle_started_at: null,
      updated_at: new Date().toISOString()
    })
    .eq('bot_id', 'main');

  // Send wallets directly in confirmation (so you have them even if /export fails)
  let exportText = `✅ Generated ${count} fresh wallets!\n\n`;
  for (let i = 0; i < wallets.length; i++) {
    exportText += `<b>${i + 1}.</b> <code>${wallets[i].address}</code>\n<code>${wallets[i].privateKey}</code>\n\n`;
  }
  exportText += `Use /run to start cycling.`;

  await sendMessage(chatId, exportText);
}