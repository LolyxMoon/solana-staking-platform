import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export default async function PoolsTest() {
  console.log('🔍 Fetching from database...');
  
  const pools = await prisma.pool.findMany({
    where: {
      hidden: false,
      isPaused: false
    }
  });
  
  console.log('✅ Found pools:', pools.length);

  return (
    <div className="p-6 text-white">
      <h1 className="text-2xl mb-4">Pools Test Page - Real Data</h1>
      <p className="mb-4">Number of pools: {pools.length}</p>
      <pre className="bg-gray-800 p-4 rounded overflow-auto">
        {JSON.stringify(pools, null, 2)}
      </pre>
    </div>
  );
}