const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.pool.update({
    where: { symbol: 'TESTA' },
    data: {
      reflectionTokenSymbol: 'TOKENB'
    }
  });
  console.log('✅ Updated reflection symbol to:', updated.reflectionTokenSymbol);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
