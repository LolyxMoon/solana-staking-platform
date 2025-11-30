import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";

/**
 * Upsert (create or update) a stake record in the database
 */
export async function upsertStake(
  userPublicKey: PublicKey,
  tokenMint: string,
  poolId: number,
  amount: BN,
  stakePda: string
) {
  try {
    console.log('💾 UPSERT STAKE - Starting:', {
      userWallet: userPublicKey.toString(),
      tokenMint,
      poolId,
      amount: amount.toString(),
      stakePda,
    });

    const response = await fetch('/api/stakes/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userWallet: userPublicKey.toString(),
        tokenMint,
        poolId,
        amount: amount.toString(), // Convert BN to string
        stakePda,
        lastUpdated: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Upsert failed:', error);
      throw new Error(error.error || 'Failed to upsert stake');
    }

    const data = await response.json();
    console.log('✅ Stake synced to database:', data);
    return data;
  } catch (error) {
    console.error('❌ Error syncing stake to database:', error);
    // Don't throw - we don't want database errors to break staking
    return null;
  }
}

/**
 * Delete a stake record from the database (when fully unstaked)
 */
export async function deleteStake(
  userPublicKey: PublicKey,
  tokenMint: string,
  poolId: number
) {
  try {
    console.log('🗑️ DELETE STAKE - Starting:', {
      userWallet: userPublicKey.toString(),
      tokenMint,
      poolId,
    });

    const response = await fetch('/api/stakes/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userWallet: userPublicKey.toString(),
        tokenMint,
        poolId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Delete failed:', error);
      throw new Error(error.error || 'Failed to delete stake');
    }

    const data = await response.json();
    console.log('✅ Stake removed from database:', data);
    return data;
  } catch (error) {
    console.error('❌ Error deleting stake from database:', error);
    // Don't throw - we don't want database errors to break staking
    return null;
  }
}