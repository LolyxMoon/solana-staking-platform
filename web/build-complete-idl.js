const fs = require('fs');
const idl = JSON.parse(fs.readFileSync('lib/staking.json', 'utf-8'));

// Complete account definitions matching the Rust structs
idl.accounts = [
  {
    name: "Platform",
    discriminator: [77, 92, 204, 58, 187, 98, 91, 12],
    type: {
      kind: "struct",
      fields: [
        { name: "admin", type: "publicKey" },
        { name: "feeCollector", type: "publicKey" },
        { name: "platformTokenFeeBps", type: "u64" },
        { name: "platformSolFee", type: "u64" },
        { name: "isInitialized", type: "bool" },
        { name: "bump", type: "u8" }
      ]
    }
  },
  {
    name: "Project",
    discriminator: [205, 222, 112, 7, 165, 155, 206, 218],
    type: {
      kind: "struct",
      fields: [
        { name: "admin", type: "publicKey" },
        { name: "tokenMint", type: "publicKey" },
        { name: "stakingVault", type: "publicKey" },
        { name: "rewardVault", type: "publicKey" },
        { name: "reflectionVault", type: { option: "publicKey" } },
        { name: "reflectionToken", type: { option: "publicKey" } },
        { name: "totalStaked", type: "u64" },
        { name: "totalRewardsDeposited", type: "u64" },
        { name: "totalRewardsClaimed", type: "u64" },
        { name: "rateBpsPerYear", type: "u64" },
        { name: "rateMode", type: "u8" },
        { name: "rewardRatePerSecond", type: "u64" },
        { name: "lockupSeconds", type: "u64" },
        { name: "poolDurationSeconds", type: "u64" },
        { name: "poolStartTime", type: "i64" },
        { name: "poolEndTime", type: "i64" },
        { name: "lastUpdateTime", type: "i64" },
        { name: "rewardPerTokenStored", type: "u64" },
        { name: "reflectionPerTokenStored", type: "u64" },
        { name: "lastReflectionUpdateTime", type: "i64" },
        { name: "referrer", type: { option: "publicKey" } },
        { name: "referrerSplitBps", type: "u64" },
        { name: "isPaused", type: "bool" },
        { name: "depositPaused", type: "bool" },
        { name: "withdrawPaused", type: "bool" },
        { name: "claimPaused", type: "bool" },
        { name: "isInitialized", type: "bool" },
        { name: "bump", type: "u8" }
      ]
    }
  },
  {
    name: "Stake",
    discriminator: [225, 28, 25, 163, 171, 175, 63, 204],
    type: {
      kind: "struct",
      fields: [
        { name: "user", type: "publicKey" },
        { name: "project", type: "publicKey" },
        { name: "amount", type: "u64" },
        { name: "lastStakeTimestamp", type: "i64" },
        { name: "withdrawalWallet", type: "publicKey" },
        { name: "rewardPerTokenPaid", type: "u64" },
        { name: "rewardsPending", type: "u64" },
        { name: "totalRewardsClaimed", type: "u64" },
        { name: "reflectionPerTokenPaid", type: "u64" },
        { name: "reflectionsPending", type: "u64" },
        { name: "totalReflectionsClaimed", type: "u64" },
        { name: "bump", type: "u8" }
      ]
    }
  }
];

fs.writeFileSync('lib/staking.json', JSON.stringify(idl, null, 2));
console.log('✅ Complete IDL created with all 3 accounts');
