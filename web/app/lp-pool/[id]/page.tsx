import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import PoolDetailClient from "@/app/pool/[id]/PoolDetailClient";

export default async function LPPoolPage({ params }: { params: { id: string } }) {
  const pool = await prisma.pool.findUnique({
    where: { id: params.id }
  });

  if (!pool || !pool.isLPPool) {
    notFound();
  }

  // Transform database pool to match PoolDetailClient interface
  const transformedPool = {
    id: pool.id,
    name: `${pool.name} LP`,
    symbol: pool.symbol,
    tokenAddress: pool.tokenMint,
    tokenMint: pool.tokenMint,
    logo: pool.logo,
    apy: pool.apy || 0,
    rateBpsPerYear: 0,
    rateMode: pool.type === "locked" ? 0 : 1,
    lockPeriodDays: pool.lockPeriod,
    duration: pool.duration || 0,  // ✅ FIXED: Use pool.duration instead of pool.lockPeriod
    totalStaked: pool.totalStaked,
    expectedRewards: null,
    isPaused: pool.isPaused,
    poolId: pool.poolId,
    reflectionEnabled: pool.hasSelfReflections || pool.hasExternalReflections || false,
    reflectionType: pool.hasSelfReflections ? 'self' : pool.hasExternalReflections ? 'external' : null,
    reflectionMint: pool.externalReflectionMint,
    isInitialized: pool.isInitialized,
    createdAt: pool.createdAt,
    creatorWallet: null,
    dexType: pool.dexType,  // ✅ ADDED
    dexPoolAddress: pool.dexPoolAddress,  // ✅ ADDED
    raydiumPoolAddress: pool.raydiumPoolAddress,  // ✅ ADDED for backwards compatibility
  };

  return <PoolDetailClient pool={transformedPool} />;
}