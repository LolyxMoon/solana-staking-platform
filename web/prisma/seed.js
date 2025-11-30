// prisma/seed.js
const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database with test pools...')

  // Clear existing data
  await prisma.activity.deleteMany({})
  await prisma.stake.deleteMany({})
  await prisma.pool.deleteMany({})
  console.log('🗑️  Cleared existing pools')

  // Valid Devnet Token Addresses with NEW SCHEMA
  const pools = [
    {
      tokenMint: 'So11111111111111111111111111111111111111112', // ✅ NEW: tokenMint
      poolId: 0, // ✅ NEW: poolId
      name: 'Solana Staking - Beginner',
      symbol: 'SOL',
      type: 'unlocked',
      apr: 8.5,
      apy: null,
      lockPeriod: null,
      totalStaked: 125000,
      rewards: '450.25 SOL',
      logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      pairAddress: null,
      featured: true,
      hidden: false,
      hasSelfReflections: false,
      hasExternalReflections: false,
    },
    {
      tokenMint: 'So11111111111111111111111111111111111111112', // Same token
      poolId: 1, // ✅ Different poolId - second SOL pool!
      name: 'Solana Staking - Advanced',
      symbol: 'SOL',
      type: 'locked',
      apr: null,
      apy: 15.0,
      lockPeriod: 90,
      totalStaked: 75000,
      rewards: '892.15 SOL',
      logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
      pairAddress: null,
      featured: false,
      hidden: false,
      hasSelfReflections: true,
      hasExternalReflections: false,
    },
    {
      tokenMint: '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU', // USDC Devnet
      poolId: 0,
      name: 'USDC Staking',
      symbol: 'USDC',
      type: 'locked',
      apr: null,
      apy: 12.5,
      lockPeriod: 30,
      totalStaked: 500000,
      rewards: '1250.00 USDC',
      logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
      pairAddress: null,
      featured: true,
      hidden: false,
      hasSelfReflections: false,
      hasExternalReflections: false,
    },
    {
      tokenMint: 'EJwZgeZrdC8TXTQbQBoL6bfuAnFUUy1PVCMB4DYPzVaS', // USDT Devnet
      poolId: 0,
      name: 'USDT Staking',
      symbol: 'USDT',
      type: 'unlocked',
      apr: 6.8,
      apy: null,
      lockPeriod: null,
      totalStaked: 350000,
      rewards: '890.50 USDT',
      logo: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB/logo.svg',
      pairAddress: null,
      featured: false,
      hidden: false,
      hasSelfReflections: false,
      hasExternalReflections: false,
    },
    {
      tokenMint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', // Bonk (example)
      poolId: 0,
      name: 'Bonk Staking',
      symbol: 'BONK',
      type: 'locked',
      apr: null,
      apy: 25.0,
      lockPeriod: 90,
      totalStaked: 1000000,
      rewards: '5000 BONK',
      logo: 'https://arweave.net/hQiPZOsRZXGXBJd_82PhVdlM_hACsT_q6wqwf5cSY7I',
      pairAddress: null,
      featured: false,
      hidden: false,
      hasSelfReflections: true,
      hasExternalReflections: false,
    },
  ]

  // Create pools
  for (const pool of pools) {
    const created = await prisma.pool.create({
      data: pool,
    })
    console.log(`✅ Created: ${created.name} (${created.symbol}) - tokenMint: ${created.tokenMint.slice(0, 8)}..., poolId: ${created.poolId}`)
  }

  console.log('🎉 Seeding complete!')
  console.log('📊 Created 5 pools:')
  console.log('   - SOL has 2 pools (poolId 0 & 1)')
  console.log('   - USDC, USDT, BONK each have 1 pool (poolId 0)')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })