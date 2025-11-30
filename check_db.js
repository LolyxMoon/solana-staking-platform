const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const stakes = await prisma.stake.findMany();
  console.log('\n📊 Stakes in database:', stakes.length);
  stakes.forEach((s, i) => {
    console.log(`\nStake ${i+1}:`);
    console.log('  userId:', s.userId);
    console.log('  poolId:', s.poolId);
    console.log('  amount:', s.amount);
  });
  
  const pools = await prisma.pool.findMany();
  console.log('\n🏊 Pools in database:', pools.length);
  
  await prisma.$disconnect();
}

check();
