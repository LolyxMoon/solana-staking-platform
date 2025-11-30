import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateReflectionAccount() {
  try {
    console.log('🔍 Looking for TESTA pool...');
    
    // First, find the pool
    const pool = await prisma.pool.findFirst({
      where: {
        symbol: 'TESTA'
      }
    });
    
    if (!pool) {
      console.log('❌ TESTA pool not found!');
      console.log('Available pools:');
      const allPools = await prisma.pool.findMany({
        select: { id: true, name: true, symbol: true }
      });
      console.log(allPools);
      return;
    }
    
    console.log('✅ Found pool:', pool.name, '(', pool.symbol, ')');
    console.log('Pool ID:', pool.id);
    
    // Update it
    console.log('\n🔄 Updating reflection account...');
    const result = await prisma.pool.update({
      where: {
        id: pool.id
      },
      data: {
        reflectionTokenAccount: '32LnFBRBgvRWfpJ8wE91DEaEiQPLqhMpyYuHhG751nWM'
      }
    });
    
    console.log('\n✅ Successfully updated!');
    console.log('Pool:', result.name);
    console.log('Reflection Account:', result.reflectionTokenAccount);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateReflectionAccount();