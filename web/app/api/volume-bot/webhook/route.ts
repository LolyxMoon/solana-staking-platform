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
const BUYS_PER_WALLET = 10;

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  
  if (!url || !key) {
    throw new Error(`Missing Supabase config: URL=${!!url}, KEY=${!!key}`);
  }
  
  return createClient(url, key);
}

async function sendMessage(chatId: number, text: string, replyMarkup?: any) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      chat_id: chatId, 
      text, 
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }),
  });
}

async function editMessage(chatId: number, messageId: number, text: string, replyMarkup?: any) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      chat_id: chatId, 
      message_id: messageId,
      text, 
      parse_mode: 'HTML',
      reply_markup: replyMarkup,
    }),
  });
}

async function answerCallback(callbackQueryId: string, text?: string) {
  await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      callback_query_id: callbackQueryId,
      text,
    }),
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

// Inline keyboards
const mainMenuKeyboard = {
  inline_keyboard: [
    [
      { text: '▶️ Start', callback_data: 'cmd_start' },
      { text: '⏹️ Stop', callback_data: 'cmd_stop' }
    ],
    [
      { text: '📊 Status', callback_data: 'cmd_status' },
      { text: '🔄 Cycle', callback_data: 'cmd_cycle' }
    ],
    [
      { text: '⚙️ Mode', callback_data: 'menu_mode' },
      { text: '🔧 Settings', callback_data: 'menu_settings' }
    ],
    [
      { text: '💰 Balances', callback_data: 'cmd_balances' },
      { text: '🏦 Master', callback_data: 'cmd_master' }
    ],
    [
      { text: '🔄 Reset', callback_data: 'cmd_reset' },
      { text: '📈 Stats', callback_data: 'cmd_stats' }
    ]
  ]
};

const modeMenuKeyboard = {
  inline_keyboard: [
    [{ text: '📈 Mode 1: Split Buys (10x per wallet)', callback_data: 'set_mode_split' }],
    [{ text: '💰 Mode 2: Custom (single buy + delay)', callback_data: 'set_mode_custom' }],
    [{ text: '⬅️ Back', callback_data: 'menu_main' }]
  ]
};

function getSettingsKeyboard(config: any) {
  return {
    inline_keyboard: [
      [
        { text: `💵 ${config.custom_buy_amount === 0.1 ? '✅ ' : ''}0.1 SOL`, callback_data: 'set_buy_0.1' },
        { text: `💵 ${config.custom_buy_amount === 0.25 ? '✅ ' : ''}0.25 SOL`, callback_data: 'set_buy_0.25' }
      ],
      [
        { text: `💵 ${config.custom_buy_amount === 0.5 ? '✅ ' : ''}0.5 SOL`, callback_data: 'set_buy_0.5' },
        { text: `💵 ${config.custom_buy_amount === 1 ? '✅ ' : ''}1 SOL`, callback_data: 'set_buy_1' }
      ],
      [
        { text: `⏱️ ${config.custom_sell_delay_minutes === 3 ? '✅ ' : ''}3 min`, callback_data: 'set_delay_3' },
        { text: `⏱️ ${config.custom_sell_delay_minutes === 5 ? '✅ ' : ''}5 min`, callback_data: 'set_delay_5' }
      ],
      [
        { text: `⏱️ ${config.custom_sell_delay_minutes === 10 ? '✅ ' : ''}10 min`, callback_data: 'set_delay_10' },
        { text: `⏱️ ${config.custom_sell_delay_minutes === 15 ? '✅ ' : ''}15 min`, callback_data: 'set_delay_15' }
      ],
      [{ text: '⬅️ Back', callback_data: 'menu_main' }]
    ]
  };
}

async function buildStatusText(supabase: any, connection: Connection) {
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

  const modeText = config?.bot_mode === 'custom' 
    ? `Custom (${config.custom_buy_amount} SOL, ${config.custom_sell_delay_minutes}min)` 
    : `Split Buys (${BUYS_PER_WALLET}x/wallet)`;

  const status = config?.is_running ? '🟢 Running' : '🔴 Stopped';
  const currentWallet = (config?.current_wallet_index || 0) + 1;
  const buyCount = config?.buy_count || 0;
  
  let phaseText = config?.cycle_phase || 'idle';
  if (config?.bot_mode === 'split_buys' && config?.cycle_phase === 'buying') {
    phaseText = `buying (${buyCount}/${BUYS_PER_WALLET})`;
  } else if (config?.bot_mode === 'custom' && config?.cycle_phase === 'waiting') {
    const buyTime = config?.custom_buy_time ? new Date(config.custom_buy_time) : null;
    if (buyTime) {
      const elapsed = Math.floor((Date.now() - buyTime.getTime()) / 60000);
      phaseText = `waiting (${elapsed}/${config.custom_sell_delay_minutes}min)`;
    }
  }

  return `
🤖 <b>Volume Bot Status</b>

<b>Status:</b> ${status}
<b>Mode:</b> ${modeText}
<b>Token:</b> ${config?.token_symbol || 'Not set'}

<b>Wallet:</b> ${currentWallet}/${wallets?.length || 0}
<b>Phase:</b> ${phaseText}
${config?.bot_mode === 'split_buys' ? `<b>Buys:</b> ${buyCount}/${BUYS_PER_WALLET}` : ''}

<b>Master:</b> ${(masterBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL
<b>Slippage:</b> ${config?.slippage_bps || 1000} bps
  `;
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();
    const supabase = getSupabase();
    const connection = new Connection(RPC_URL, 'confirmed');

    // ========== HANDLE CALLBACK QUERIES (BUTTON PRESSES) ==========
    if (update.callback_query) {
      const callback = update.callback_query;
      const chatId = callback.message.chat.id;
      const messageId = callback.message.message_id;
      const userId = callback.from.id;
      const data = callback.data;

      if (!isAuthorized(userId)) {
        await answerCallback(callback.id, '❌ Unauthorized');
        return NextResponse.json({ ok: true });
      }

      const { data: config } = await supabase
        .from('volume_bot_config')
        .select('*')
        .eq('bot_id', 'main')
        .single();

      // Menu navigation
      if (data === 'menu_main') {
        const statusText = await buildStatusText(supabase, connection);
        await editMessage(chatId, messageId, statusText, mainMenuKeyboard);
        await answerCallback(callback.id);
      }
      else if (data === 'menu_mode') {
        const modeText = `
⚙️ <b>Select Bot Mode</b>

<b>Current:</b> ${config?.bot_mode === 'custom' ? 'Custom' : 'Split Buys'}

<b>Mode 1 - Split Buys:</b>
Fund wallet → ${BUYS_PER_WALLET} small buys (1/min) → Sell all → Next wallet
Best for consistent volume.

<b>Mode 2 - Custom:</b>
Fund wallet → 1 buy (your amount) → Wait (your delay) → Sell → Next wallet
Best for larger, controlled trades.
        `;
        await editMessage(chatId, messageId, modeText, modeMenuKeyboard);
        await answerCallback(callback.id);
      }
      else if (data === 'menu_settings') {
        const settingsText = `
🔧 <b>Custom Mode Settings</b>

<b>Buy Amount:</b> ${config?.custom_buy_amount || 0.5} SOL
<b>Sell Delay:</b> ${config?.custom_sell_delay_minutes || 5} minutes

Select new values:
        `;
        await editMessage(chatId, messageId, settingsText, getSettingsKeyboard(config));
        await answerCallback(callback.id);
      }

      // Mode selection
      else if (data === 'set_mode_split') {
        await supabase
          .from('volume_bot_config')
          .update({ bot_mode: 'split_buys', cycle_phase: 'idle', buy_count: 0 })
          .eq('bot_id', 'main');
        await editMessage(chatId, messageId, `✅ Mode: <b>Split Buys</b>\n\n${BUYS_PER_WALLET} sequential buys per wallet.`, mainMenuKeyboard);
        await answerCallback(callback.id, 'Mode: Split Buys');
      }
      else if (data === 'set_mode_custom') {
        await supabase
          .from('volume_bot_config')
          .update({ bot_mode: 'custom', cycle_phase: 'idle' })
          .eq('bot_id', 'main');
        await editMessage(chatId, messageId, `✅ Mode: <b>Custom</b>\n\nBuy: ${config?.custom_buy_amount || 0.5} SOL\nDelay: ${config?.custom_sell_delay_minutes || 5} min`, mainMenuKeyboard);
        await answerCallback(callback.id, 'Mode: Custom');
      }

      // Buy amount settings
      else if (data.startsWith('set_buy_')) {
        const amount = parseFloat(data.replace('set_buy_', ''));
        await supabase.from('volume_bot_config').update({ custom_buy_amount: amount }).eq('bot_id', 'main');
        const updatedConfig = { ...config, custom_buy_amount: amount };
        await editMessage(chatId, messageId, `✅ Buy amount: <b>${amount} SOL</b>`, getSettingsKeyboard(updatedConfig));
        await answerCallback(callback.id, `Buy: ${amount} SOL`);
      }

      // Delay settings
      else if (data.startsWith('set_delay_')) {
        const delay = parseInt(data.replace('set_delay_', ''));
        await supabase.from('volume_bot_config').update({ custom_sell_delay_minutes: delay }).eq('bot_id', 'main');
        const updatedConfig = { ...config, custom_sell_delay_minutes: delay };
        await editMessage(chatId, messageId, `✅ Sell delay: <b>${delay} minutes</b>`, getSettingsKeyboard(updatedConfig));
        await answerCallback(callback.id, `Delay: ${delay} min`);
      }

      // Commands via buttons
      else if (data === 'cmd_start') {
        if (!config?.token_mint) {
          await answerCallback(callback.id, '❌ Set token first!');
          return NextResponse.json({ ok: true });
        }
        await supabase.from('volume_bot_config').update({ is_running: true, cycle_phase: 'idle' }).eq('bot_id', 'main');
        const statusText = await buildStatusText(supabase, connection);
        await editMessage(chatId, messageId, `🚀 <b>Bot Started!</b>\n${statusText}`, mainMenuKeyboard);
        await answerCallback(callback.id, 'Bot started!');
      }
      else if (data === 'cmd_stop') {
        await supabase.from('volume_bot_config').update({ is_running: false }).eq('bot_id', 'main');
        const statusText = await buildStatusText(supabase, connection);
        await editMessage(chatId, messageId, `⏹️ <b>Bot Stopped</b>\n${statusText}`, mainMenuKeyboard);
        await answerCallback(callback.id, 'Bot stopped');
      }
      else if (data === 'cmd_status') {
        const statusText = await buildStatusText(supabase, connection);
        await editMessage(chatId, messageId, statusText, mainMenuKeyboard);
        await answerCallback(callback.id);
      }
      else if (data === 'cmd_cycle') {
        const currentIndex = config?.current_wallet_index || 0;
        const phase = config?.cycle_phase || 'idle';
        const buyCount = config?.buy_count || 0;
        
        let cycleText = '';
        if (config?.bot_mode === 'custom') {
          const buyTime = config?.custom_buy_time ? new Date(config.custom_buy_time) : null;
          let waitInfo = '';
          if (buyTime && phase === 'waiting') {
            const elapsed = Math.floor((Date.now() - buyTime.getTime()) / 60000);
            waitInfo = `\n<b>Waiting:</b> ${elapsed}/${config.custom_sell_delay_minutes} min`;
          }
          cycleText = `
🔄 <b>Cycle Info (Custom Mode)</b>

<b>Wallet:</b> ${currentIndex + 1}/${TOTAL_WALLETS}
<b>Phase:</b> ${phase}${waitInfo}
<b>Buy Amount:</b> ${config.custom_buy_amount} SOL
<b>Sell Delay:</b> ${config.custom_sell_delay_minutes} min

<b>Flow:</b> Fund → Buy → Wait → Sell → Withdraw → Next
          `;
        } else {
          cycleText = `
🔄 <b>Cycle Info (Split Buys Mode)</b>

<b>Wallet:</b> ${currentIndex + 1}/${TOTAL_WALLETS}
<b>Phase:</b> ${phase}
<b>Buys:</b> ${buyCount}/${BUYS_PER_WALLET}

<b>Flow:</b> Fund → ${BUYS_PER_WALLET} buys (1/min) → Sell all → Withdraw → Next
          `;
        }
        await editMessage(chatId, messageId, cycleText, mainMenuKeyboard);
        await answerCallback(callback.id);
      }
      else if (data === 'cmd_reset') {
        await supabase.from('volume_bot_config').update({
          cycle_phase: 'idle',
          buy_count: 0,
          custom_buy_time: null,
        }).eq('bot_id', 'main');
        await editMessage(chatId, messageId, '✅ Cycle reset! Phase set to idle.', mainMenuKeyboard);
        await answerCallback(callback.id, 'Reset!');
      }
      else if (data === 'cmd_master') {
        if (!MASTER_KEY) {
          await answerCallback(callback.id, '❌ Master key not set');
          return NextResponse.json({ ok: true });
        }
        const masterWallet = Keypair.fromSecretKey(parsePrivateKey(MASTER_KEY));
        const balance = await connection.getBalance(masterWallet.publicKey);
        const text = `
🏦 <b>Master Wallet</b>

<b>Address:</b> <code>${masterWallet.publicKey.toString()}</code>
<b>Balance:</b> ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL

<a href="https://solscan.io/account/${masterWallet.publicKey.toString()}">View on Solscan</a>
        `;
        await editMessage(chatId, messageId, text, mainMenuKeyboard);
        await answerCallback(callback.id);
      }
      else if (data === 'cmd_balances') {
        await answerCallback(callback.id, 'Loading balances...');
        
        const { data: wallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address')
          .eq('bot_id', 'main')
          .order('created_at', { ascending: true });

        if (!wallets || wallets.length === 0) {
          await editMessage(chatId, messageId, '❌ No wallets configured', mainMenuKeyboard);
          return NextResponse.json({ ok: true });
        }

        let balanceText = '<b>💰 Wallet Balances</b>\n\n';
        let totalSol = 0;
        const currentIndex = config?.current_wallet_index || 0;

        for (let i = 0; i < Math.min(wallets.length, 10); i++) {
          const w = wallets[i];
          try {
            const pubkey = new PublicKey(w.wallet_address);
            const solBalance = await connection.getBalance(pubkey);
            const solAmount = solBalance / LAMPORTS_PER_SOL;
            totalSol += solAmount;
            const marker = i === currentIndex ? '👉 ' : '';
            balanceText += `${marker}<b>${i + 1}.</b> ${solAmount.toFixed(4)} SOL\n`;
          } catch {}
        }

        if (wallets.length > 10) {
          balanceText += `\n<i>...and ${wallets.length - 10} more</i>\n`;
        }

        if (MASTER_KEY) {
          const masterWallet = Keypair.fromSecretKey(parsePrivateKey(MASTER_KEY));
          const masterBal = await connection.getBalance(masterWallet.publicKey);
          balanceText += `\n🏦 <b>Master:</b> ${(masterBal / LAMPORTS_PER_SOL).toFixed(4)} SOL`;
        }

        balanceText += `\n\n<b>Total in wallets:</b> ${totalSol.toFixed(4)} SOL`;
        await editMessage(chatId, messageId, balanceText, mainMenuKeyboard);
      }
      else if (data === 'cmd_stats') {
        const { data: trades } = await supabase
          .from('volume_bot_trades')
          .select('trade_type, sol_amount, status, created_at')
          .eq('bot_id', 'main')
          .order('created_at', { ascending: false })
          .limit(100);

        const successful = trades?.filter((t: any) => t.status === 'success') || [];
        const buys = successful.filter((t: any) => t.trade_type === 'buy');
        const sells = successful.filter((t: any) => t.trade_type === 'sell');
        const totalVolume = buys.reduce((sum: number, t: any) => sum + (t.sol_amount || 0), 0);

        const statsText = `
📊 <b>Trading Stats</b>

<b>Total Trades:</b> ${successful.length}
<b>Buys:</b> ${buys.length}
<b>Sells:</b> ${sells.length}
<b>Buy Volume:</b> ${totalVolume.toFixed(4)} SOL

<b>Last Trade:</b> ${trades?.[0] ? new Date(trades[0].created_at).toLocaleString() : 'N/A'}
        `;
        await editMessage(chatId, messageId, statsText, mainMenuKeyboard);
        await answerCallback(callback.id);
      }

      return NextResponse.json({ ok: true });
    }

    // ========== HANDLE TEXT MESSAGES ==========
    const message = update.message;
    if (!message?.text) return NextResponse.json({ ok: true });
    
    const chatId = message.chat.id;
    const userId = message.from.id;
    const text = message.text.trim();
    
    if (!isAuthorized(userId)) {
      await sendMessage(chatId, '❌ Unauthorized');
      return NextResponse.json({ ok: true });
    }

    const [command, ...args] = text.split(' ');

    switch (command.toLowerCase()) {
      case '/menu':
      case '/start':
      case '/help': {
        const statusText = await buildStatusText(supabase, connection);
        await sendMessage(chatId, statusText, mainMenuKeyboard);
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

        await sendMessage(chatId, `✅ Token set!\n\n<b>Mint:</b> <code>${mint}</code>\n<b>Symbol:</b> ${symbol}\n<b>Decimals:</b> ${decimals}`, mainMenuKeyboard);
        break;
      }

      case '/wallets': {
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

        await sendMessage(chatId, `✅ Slippage set to ${bps} bps (${bps / 100}%)`, mainMenuKeyboard);
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
              slippageBps: (config.slippage_bps || 1000).toString(),
            });

            const quoteRes = await fetch(`https://api.jup.ag/swap/v1/quote?${params}`);
            if (!quoteRes.ok) continue;

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

            if (!swapRes.ok) continue;
            const swapData = await swapRes.json();

            const tx = VersionedTransaction.deserialize(Buffer.from(swapData.swapTransaction, 'base64'));
            tx.sign([wallet]);

            await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
            drained++;
            totalTokens += rawAmount;

            await new Promise(r => setTimeout(r, 500));
          } catch (err) {
            console.error('Drain error:', err);
          }
        }

        await sendMessage(chatId, `✅ Drained ${drained} wallets\n💰 ~${totalTokens.toLocaleString()} tokens sold`, mainMenuKeyboard);
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
        await sendMessage(chatId, `✅ Withdrew from ${withdrawn} wallets\n💰 ~${totalSol.toFixed(4)} SOL\n🏦 Master now: ${(newMasterBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL`, mainMenuKeyboard);
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
        await sendMessage(chatId, '❓ Unknown command. Use /menu', mainMenuKeyboard);
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

  await supabase.from('volume_bot_wallets').delete().eq('bot_id', 'main');

  const walletRows = wallets.map(w => ({
    bot_id: 'main',
    wallet_address: w.address,
    private_key_encrypted: w.privateKey,
  }));

  const { error: insertError } = await supabase.from('volume_bot_wallets').insert(walletRows);

  if (insertError) {
    await sendMessage(chatId, `❌ Failed to save wallets: ${insertError.message}`, undefined);
    return;
  }

  await supabase.from('volume_bot_config').update({
    current_wallet_index: 0,
    cycle_phase: 'idle',
    cycle_started_at: null,
    buy_count: 0,
    custom_buy_time: null,
  }).eq('bot_id', 'main');

  let exportText = `✅ Generated ${count} fresh wallets!\n\n`;
  for (let i = 0; i < wallets.length; i++) {
    exportText += `<b>${i + 1}.</b> <code>${wallets[i].address}</code>\n<code>${wallets[i].privateKey}</code>\n\n`;
  }
  exportText += `Use /menu to start.`;

  await sendMessage(chatId, exportText, undefined);
}