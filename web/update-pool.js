const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const pool = await prisma.pool.findFirst({
    where: { symbol: 'TESTA' }
  });
  
  if (!pool) {
    console.log('Pool not found');
    return;
  }
  
  console.log('Found pool:', pool.name);
  
  const updated = await prisma.pool.update({
    where: { id: pool.id },
    data: {
      reflectionTokenAccount: '32LnFBRBgvRWfpJ8wE91DEaEiQPLqhMpyYuHhG751nWM'
    }
  });
  
  console.log('✅ Updated! Reflection Account:', updated.reflectionTokenAccount);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
