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

// Reliable token balance check using getParsedTokenAccountsByOwner
async function getTokenBalance(connection: Connection, wallet: PublicKey, tokenMint: string): Promise<{ amount: number; rawAmount: number }> {
  try {
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
      wallet,
      { mint: new PublicKey(tokenMint) }
    );
    
    if (tokenAccounts.value.length === 0) {
      return { amount: 0, rawAmount: 0 };
    }
    
    const info = tokenAccounts.value[0].account.data.parsed.info;
    const rawAmount = Number(info.tokenAmount.amount);
    const decimals = info.tokenAmount.decimals;
    const amount = rawAmount / Math.pow(10, decimals);
    
    return { amount, rawAmount };
  } catch (err) {
    console.error('Error getting token balance:', err);
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
🤖 <b>Volume Bot Commands</b>

<b>Setup:</b>
/token &lt;mint&gt; - Set token to trade
/wallets &lt;count&gt; - Generate wallets (1-10)
/fund &lt;sol&gt; - Fund all wallets from master
/amount &lt;min&gt; &lt;max&gt; - Set SOL range per trade
/interval &lt;seconds&gt; - Set trade interval
/slippage &lt;bps&gt; - Set slippage (default 300)

<b>Control:</b>
/run - Start trading
/stop - Stop trading
/status - View bot status
/balances - Check all wallet balances
/stats - View trading stats

<b>Recovery:</b>
/drain - Sell all tokens in all wallets to SOL
/withdraw - Send all SOL back to master

<b>Info:</b>
/export - Export wallet keys
/errors - View recent errors
/cron - Get cron URL

<b>⚠️ IMPORTANT:</b> Always /export before /wallets!
        `);
        break;
      }

      case '/token': {
        if (!args[0]) {
          await sendMessage(chatId, '❌ Usage: /token <mint_address>');
          break;
        }
        
        const mint = args[0];
        try {
          new PublicKey(mint);
        } catch {
          await sendMessage(chatId, '❌ Invalid mint address');
          break;
        }

        let symbol = 'TOKEN';
        let decimals = 9;
        try {
          const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
          const data = await res.json();
          if (data.pairs?.[0]?.baseToken) {
            symbol = data.pairs[0].baseToken.symbol;
          }
          
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
        const count = Math.min(Math.max(parseInt(args[0]) || 3, 1), 10);
        
        // Check if wallets already exist with funds
        const { data: existingWallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address, private_key_encrypted')
          .eq('bot_id', 'main');

        if (existingWallets && existingWallets.length > 0) {
          // Check balances
          let totalSol = 0;
          let totalTokens = 0;
          const { data: config } = await supabase
            .from('volume_bot_config')
            .select('token_mint, token_decimals')
            .eq('bot_id', 'main')
            .single();

          for (const w of existingWallets) {
            try {
              const pubkey = new PublicKey(w.wallet_address);
              const solBal = await connection.getBalance(pubkey);
              totalSol += solBal / LAMPORTS_PER_SOL;

              if (config?.token_mint) {
                const { amount } = await getTokenBalance(connection, pubkey, config.token_mint);
                totalTokens += amount;
              }
            } catch {}
          }

          if (totalSol > 0.001 || totalTokens > 0) {
            await sendMessage(chatId, `
⚠️ <b>WARNING: Existing wallets have funds!</b>

<b>Current wallets:</b> ${existingWallets.length}
<b>Total SOL:</b> ${totalSol.toFixed(4)}
<b>Total tokens:</b> ${totalTokens.toLocaleString()}

Creating new wallets will <b>DELETE</b> these forever!

<b>Options:</b>
1. /export - Save current keys first
2. /drain - Sell tokens to SOL first
3. /withdraw - Send SOL to master first
4. /wallets_confirm ${count} - Proceed anyway (DANGEROUS)
            `);
            break;
          }
        }

        // Safe to create - no existing wallets or they're empty
        await createNewWallets(supabase, chatId, count);
        break;
      }

      case '/wallets_confirm': {
        const count = Math.min(Math.max(parseInt(args[0]) || 3, 1), 10);
        await createNewWallets(supabase, chatId, count);
        break;
      }

      case '/drain': {
        const { data: wallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address, private_key_encrypted')
          .eq('bot_id', 'main');

        const { data: config } = await supabase
          .from('volume_bot_config')
          .select('token_mint, token_decimals, slippage_bps')
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

        for (const w of wallets) {
          try {
            const wallet = Keypair.fromSecretKey(parsePrivateKey(w.private_key_encrypted));
            
            // Use reliable token balance check
            const { amount, rawAmount } = await getTokenBalance(connection, wallet.publicKey, config.token_mint);

            if (rawAmount === 0) continue;

            // Sell all tokens
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

            const { VersionedTransaction } = await import('@solana/web3.js');
            const tx = VersionedTransaction.deserialize(Buffer.from(orderData.transaction, 'base64'));
            tx.sign([wallet]);

            await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
            
            drained++;
            totalTokens += amount;
          } catch (err) {
            console.error('Drain error:', err);
          }
        }

        await sendMessage(chatId, `✅ Drained ${drained} wallets\n💰 ~${totalTokens.toLocaleString()} tokens sold`);
        break;
      }

      case '/withdraw': {
        const masterKey = process.env.VOLUME_BOT_MASTER_KEY;
        if (!masterKey) {
          await sendMessage(chatId, '❌ VOLUME_BOT_MASTER_KEY not set');
          break;
        }

        const masterWallet = Keypair.fromSecretKey(parsePrivateKey(masterKey));

        const { data: wallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address, private_key_encrypted')
          .eq('bot_id', 'main');

        if (!wallets || wallets.length === 0) {
          await sendMessage(chatId, '❌ No wallets');
          break;
        }

        await sendMessage(chatId, `⏳ Withdrawing SOL to master...`);

        const { Transaction, SystemProgram } = await import('@solana/web3.js');
        let withdrawn = 0;
        let totalSol = 0;

        for (const w of wallets) {
          try {
            const wallet = Keypair.fromSecretKey(parsePrivateKey(w.private_key_encrypted));
            const balance = await connection.getBalance(wallet.publicKey);
            
            // Leave 0.001 SOL for rent
            const sendAmount = balance - 0.001 * LAMPORTS_PER_SOL;
            if (sendAmount <= 0) continue;

            const tx = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: wallet.publicKey,
                toPubkey: masterWallet.publicKey,
                lamports: Math.floor(sendAmount),
              })
            );

            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;
            tx.sign(wallet);

            await connection.sendRawTransaction(tx.serialize());
            withdrawn++;
            totalSol += sendAmount / LAMPORTS_PER_SOL;
          } catch (err) {
            console.error('Withdraw error:', err);
          }
        }

        await sendMessage(chatId, `✅ Withdrew from ${withdrawn} wallets\n💰 ~${totalSol.toFixed(4)} SOL sent to master`);
        break;
      }

      case '/fund': {
        const solAmount = parseFloat(args[0]);
        if (!solAmount || solAmount <= 0) {
          await sendMessage(chatId, '❌ Usage: /fund <sol_per_wallet>');
          break;
        }

        const masterKey = process.env.VOLUME_BOT_MASTER_KEY;
        if (!masterKey) {
          await sendMessage(chatId, '❌ VOLUME_BOT_MASTER_KEY not set');
          break;
        }

        const { data: wallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address')
          .eq('bot_id', 'main');

        if (!wallets || wallets.length === 0) {
          await sendMessage(chatId, '❌ No wallets. Use /wallets first');
          break;
        }

        const masterWallet = Keypair.fromSecretKey(parsePrivateKey(masterKey));
        const masterBalance = await connection.getBalance(masterWallet.publicKey);
        const totalNeeded = solAmount * wallets.length * LAMPORTS_PER_SOL;

        if (masterBalance < totalNeeded + 0.01 * LAMPORTS_PER_SOL) {
          await sendMessage(chatId, `❌ Insufficient master balance!\n\nHave: ${(masterBalance / LAMPORTS_PER_SOL).toFixed(4)} SOL\nNeed: ${(totalNeeded / LAMPORTS_PER_SOL).toFixed(4)} SOL\n\nMaster: <code>${masterWallet.publicKey.toString()}</code>`);
          break;
        }

        await sendMessage(chatId, `⏳ Funding ${wallets.length} wallets with ${solAmount} SOL each...`);

        const { Transaction, SystemProgram } = await import('@solana/web3.js');
        let funded = 0;
        
        for (const w of wallets) {
          try {
            const tx = new Transaction().add(
              SystemProgram.transfer({
                fromPubkey: masterWallet.publicKey,
                toPubkey: new PublicKey(w.wallet_address),
                lamports: Math.floor(solAmount * LAMPORTS_PER_SOL),
              })
            );
            
            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = masterWallet.publicKey;
            tx.sign(masterWallet);
            
            await connection.sendRawTransaction(tx.serialize());
            funded++;
          } catch (err) {
            console.error('Fund error:', err);
          }
        }

        await sendMessage(chatId, `✅ Funded ${funded}/${wallets.length} wallets with ${solAmount} SOL each`);
        break;
      }

      case '/amount': {
        const min = parseFloat(args[0]);
        const max = parseFloat(args[1]) || min;
        
        if (!min || min <= 0) {
          await sendMessage(chatId, '❌ Usage: /amount <min_sol> <max_sol>');
          break;
        }

        await supabase
          .from('volume_bot_config')
          .update({ 
            min_sol_amount: Math.min(min, max), 
            max_sol_amount: Math.max(min, max),
            updated_at: new Date().toISOString() 
          })
          .eq('bot_id', 'main');

        await sendMessage(chatId, `✅ Trade amount: ${Math.min(min, max)} - ${Math.max(min, max)} SOL`);
        break;
      }

      case '/interval': {
        const seconds = parseInt(args[0]);
        if (!seconds || seconds < 10) {
          await sendMessage(chatId, '❌ Usage: /interval <seconds> (min 10)');
          break;
        }

        await supabase
          .from('volume_bot_config')
          .update({ interval_seconds: seconds, updated_at: new Date().toISOString() })
          .eq('bot_id', 'main');

        await sendMessage(chatId, `✅ Interval set to ${seconds} seconds`);
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

        if (!wallets || wallets.length === 0) {
          await sendMessage(chatId, '❌ Generate wallets first with /wallets');
          break;
        }

        await supabase
          .from('volume_bot_config')
          .update({ is_running: true, updated_at: new Date().toISOString() })
          .eq('bot_id', 'main');

        await sendMessage(chatId, `🚀 Bot started!\n\n<b>Token:</b> ${config.token_symbol}\n<b>Wallets:</b> ${wallets.length}\n<b>Amount:</b> ${config.min_sol_amount}-${config.max_sol_amount} SOL\n<b>Interval:</b> ${config.interval_seconds}s\n<b>Slippage:</b> ${config.slippage_bps} bps`);
        break;
      }

      case '/stop': {
        await supabase
          .from('volume_bot_config')
          .update({ is_running: false, updated_at: new Date().toISOString() })
          .eq('bot_id', 'main');

        await sendMessage(chatId, '⏹ Bot stopped');
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

        const status = config?.is_running ? '🟢 Running' : '🔴 Stopped';
        
        await sendMessage(chatId, `
<b>Volume Bot Status</b>

<b>Status:</b> ${status}
<b>Token:</b> ${config?.token_symbol || 'Not set'} 
<b>Mint:</b> <code>${config?.token_mint || 'Not set'}</code>
<b>Wallets:</b> ${wallets?.length || 0}
<b>Amount:</b> ${config?.min_sol_amount || 0}-${config?.max_sol_amount || 0} SOL
<b>Interval:</b> ${config?.interval_seconds || 60}s
<b>Slippage:</b> ${config?.slippage_bps || 300} bps
        `);
        break;
      }

      case '/balances': {
        const { data: wallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address')
          .eq('bot_id', 'main');

        const { data: config } = await supabase
          .from('volume_bot_config')
          .select('token_mint, token_symbol, token_decimals')
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

            balanceText += `${i + 1}. ${solAmount.toFixed(4)} SOL`;
            if (config?.token_mint) {
              balanceText += ` | ${tokenAmount.toLocaleString()} ${config.token_symbol}`;
            }
            balanceText += `\n<code>${w.wallet_address}</code>\n\n`;
          } catch {}
        }

        balanceText += `<b>Total:</b> ${totalSol.toFixed(4)} SOL`;
        if (config?.token_mint) {
          balanceText += ` | ${totalToken.toLocaleString()} ${config.token_symbol}`;
        }

        await sendMessage(chatId, balanceText);
        break;
      }

      case '/stats': {
        const { data: trades } = await supabase
          .from('volume_bot_trades')
          .select('trade_type, sol_amount, status, created_at')
          .eq('bot_id', 'main');

        if (!trades || trades.length === 0) {
          await sendMessage(chatId, '📊 No trades yet');
          break;
        }

        const successful = trades.filter(t => t.status === 'success');
        const buys = successful.filter(t => t.trade_type === 'buy');
        const sells = successful.filter(t => t.trade_type === 'sell');
        const errors = trades.filter(t => t.status === 'failed');
        const totalVolume = successful.reduce((sum, t) => sum + (t.sol_amount || 0), 0);

        const firstTrade = trades[trades.length - 1]?.created_at;
        const lastTrade = trades[0]?.created_at;

        await sendMessage(chatId, `
<b>📊 Trading Stats</b>

<b>Total Trades:</b> ${successful.length}
<b>Buys:</b> ${buys.length}
<b>Sells:</b> ${sells.length}
<b>Errors:</b> ${errors.length}
<b>Volume:</b> ${totalVolume.toFixed(4)} SOL

<b>First Trade:</b> ${firstTrade ? new Date(firstTrade).toLocaleString() : 'N/A'}
<b>Last Trade:</b> ${lastTrade ? new Date(lastTrade).toLocaleString() : 'N/A'}
        `);
        break;
      }

      case '/errors': {
        const { data: errors } = await supabase
          .from('volume_bot_trades')
          .select('wallet_address, error_message, created_at')
          .eq('bot_id', 'main')
          .eq('status', 'failed')
          .order('created_at', { ascending: false })
          .limit(5);

        if (!errors || errors.length === 0) {
          await sendMessage(chatId, '✅ No recent errors');
          break;
        }

        let errorText = '<b>Recent Errors</b>\n\n';
        for (const e of errors) {
          errorText += `<b>${new Date(e.created_at).toLocaleTimeString()}</b>\n`;
          errorText += `${e.error_message || 'Unknown error'}\n\n`;
        }

        await sendMessage(chatId, errorText);
        break;
      }

      case '/export': {
        const { data: wallets } = await supabase
          .from('volume_bot_wallets')
          .select('wallet_address, private_key_encrypted')
          .eq('bot_id', 'main');

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
<b>🔄 Cron Setup</b>

Add this URL to cron-job.org (every 1 min):

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

  // Clear old wallets and insert new
  await supabase.from('volume_bot_wallets').delete().eq('bot_id', 'main');
  
  for (const w of wallets) {
    await supabase.from('volume_bot_wallets').insert({
      bot_id: 'main',
      wallet_address: w.address,
      private_key_encrypted: w.privateKey,
    });
  }

  let exportText = `✅ Generated ${count} wallets!\n\n`;
  for (let i = 0; i < wallets.length; i++) {
    exportText += `<b>${i + 1}.</b> <code>${wallets[i].address}</code>\n<code>${wallets[i].privateKey}</code>\n\n`;
  }
  exportText += `⚠️ <b>SAVE THESE KEYS!</b>\n\nUse /fund <sol> to fund them`;

  await sendMessage(chatId, exportText);
}