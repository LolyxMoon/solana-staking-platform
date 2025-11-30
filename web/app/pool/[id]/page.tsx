import { notFound } from "next/navigation";
import PoolDetailClient from "./PoolDetailClient";
import prisma from "@/lib/prisma";

export const dynamic = 'force-dynamic';

interface PageProps {
  params: {
    id: string;
  };
}

async function getPool(id: string) {
  try {
    const pool = await prisma.pool.findUnique({
      where: { id },
    });

    if (!pool || pool.hidden) {
      return null;
    }

    // Transform database pool to match PoolDetailClient interface
    // Parse expected rewards safely
    let expectedRewards = 0;
    if (pool.rewards && !isNaN(parseFloat(pool.rewards))) {
      expectedRewards = parseFloat(pool.rewards);
    }

    return {
      id: pool.id,
      name: pool.name === "Unknown Token" ? pool.symbol : pool.name, // Use symbol if name is unknown
      symbol: pool.symbol,
      tokenAddress: pool.tokenMint, // Use tokenMint for staking operations
      tokenMint: pool.tokenMint,
      logo: pool.logo,
      apy: pool.apy || 0,
      rateBpsPerYear: 0, // Will be fetched from on-chain data
      rateMode: 1, // Dynamic APR
      lockPeriodDays: pool.lockPeriod,
      duration: pool.lockPeriod || 0, // Same as lock period for now
      totalStaked: pool.totalStaked,
      expectedRewards: expectedRewards,
      isPaused: pool.isPaused,
      poolId: pool.poolId,
      reflectionEnabled: pool.hasSelfReflections || pool.hasExternalReflections,
      reflectionType: pool.hasSelfReflections ? 'self' : pool.hasExternalReflections ? 'external' : null,
      reflectionMint: pool.externalReflectionMint,
      isInitialized: pool.isInitialized,
      createdAt: pool.createdAt,
      creatorWallet: null,
    };
  } catch (error) {
    console.error("Error fetching pool:", error);
    return null;
  }
}

export default async function PoolPage({ params }: PageProps) {
  const pool = await getPool(params.id);

  if (!pool) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-black">
      <PoolDetailClient pool={pool} />
    </div>
  );
}

