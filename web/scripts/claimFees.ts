// scripts/claimFees.ts
// Script to claim all accumulated Jupiter referral fees
// Run with: npx ts-node scripts/claimFees.ts

import { ReferralProvider } from "@jup-ag/referral-sdk";
import { Connection, Keypair, PublicKey, sendAndConfirmTransaction } from "@solana/web3.js";
import fs from 'fs';

// Configuration
const RPC_URL = "https://api.mainnet-beta.solana.com"; // or your preferred RPC
const WALLET_PATH = "/path/to/your/admin/wallet.json"; // Update this path
const REFERRAL_ACCOUNT = "YOUR_REFERRAL_ACCOUNT_PUBKEY"; // Update this

async function claimFees() {
  console.log('🪙 Jupiter Fee Claim Script');
  console.log('===========================\n');

  try {
    // Setup connection and wallet
    const connection = new Connection(RPC_URL);
    const privateKeyArray = JSON.parse(
      fs.readFileSync(WALLET_PATH, 'utf8').trim()
    );
    const wallet = Keypair.fromSecretKey(new Uint8Array(privateKeyArray));
    
    console.log('📋 Configuration:');
    console.log('  Wallet:', wallet.publicKey.toBase58());
    console.log('  Referral Account:', REFERRAL_ACCOUNT);
    console.log('  RPC:', RPC_URL);
    console.log('');

    // Initialize provider
    const provider = new ReferralProvider(connection);

    // Get claimable fees
    console.log('🔍 Checking claimable fees...\n');
    
    const referralAccountPubKey = new PublicKey(REFERRAL_ACCOUNT);
    
    // Get all token accounts with balances
    const tokenAccounts = await connection.getTokenAccountsByOwner(
      referralAccountPubKey,
      { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
    );

    if (tokenAccounts.value.length === 0) {
      console.log('ℹ️  No token accounts found');
      return;
    }

    console.log(`Found ${tokenAccounts.value.length} token account(s)\n`);

    // Claim all fees
    console.log('💰 Claiming all fees...\n');
    
    const transactions = await provider.claimAllV2({
      payerPubKey: wallet.publicKey,
      referralAccountPubKey,
    });

    if (transactions.length === 0) {
      console.log('✅ No fees to claim at this time');
      return;
    }

    console.log(`📦 ${transactions.length} claim transaction(s) to process\n`);

    // Send each claim transaction
    let successCount = 0;
    for (let i = 0; i < transactions.length; i++) {
      const transaction = transactions[i];
      
      console.log(`Processing transaction ${i + 1}/${transactions.length}...`);
      
      try {
        const signature = await sendAndConfirmTransaction(
          connection,
          transaction,
          [wallet],
          { commitment: 'confirmed' }
        );
        
        console.log(`✅ Success! TX: https://solscan.io/tx/${signature}`);
        successCount++;
        
        // Wait a bit between transactions
        if (i < transactions.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`❌ Failed: ${error.message}`);
      }
      
      console.log('');
    }

    console.log('===========================');
    console.log(`🎉 Claimed fees from ${successCount}/${transactions.length} transactions`);
    console.log('\n💡 Tip: Fees are split:');
    console.log('   - 80% to your wallet');
    console.log('   - 20% to Jupiter');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('\nMake sure to:');
    console.error('1. Update WALLET_PATH with your admin wallet path');
    console.error('2. Update REFERRAL_ACCOUNT with your referral account pubkey');
    console.error('3. Install dependencies: npm install @jup-ag/referral-sdk @solana/web3.js@1');
  }
}

// Run the script
claimFees().then(() => {
  console.log('\n✅ Script complete');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Script failed:', error);
  process.exit(1);
});