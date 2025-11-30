import { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import EmbedPoolClient from "./EmbedPoolClient";

export const dynamic = 'force-dynamic';

interface PageProps {
  params: {
    id: string;
  };
  searchParams: {
    color?: string;
    theme?: string;
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

    // Transform database pool to match client interface
    let expectedRewards = 0;
    if (pool.rewards && !isNaN(parseFloat(pool.rewards))) {
      expectedRewards = parseFloat(pool.rewards);
    }

    return {
    id: pool.id,
    name: pool.name === "Unknown Token" ? pool.symbol : pool.name,
    symbol: pool.symbol,
    tokenAddress: pool.tokenMint,
    tokenMint: pool.tokenMint,
    logo: pool.logo,
    apy: pool.apy || 0,
    rateBpsPerYear: 0,
    rateMode: 1,
    lockPeriodDays: pool.lockPeriod,
    duration: pool.lockPeriod || 0,
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

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const pool = await getPool(params.id);

  if (!pool) {
    return {
      title: "Pool Not Found",
    };
  }

  return {
    title: `${pool.name} Staking Pool | StakePoint Embed`,
    description: `Stake ${pool.symbol} and earn rewards with ${pool.apy}% APY`,
  };
}

export default async function EmbedPoolPage({ params, searchParams }: PageProps) {
  const pool = await getPool(params.id);

  if (!pool) {
    notFound();
  }

  // Add # back to color if not present
  const rawColor = searchParams.color || "fb57ff";
  const buttonColor = rawColor.startsWith('#') ? rawColor : `#${rawColor}`;
  
  const theme = (searchParams.theme === "light" ? "light" : "dark") as "dark" | "light";

  return (
    <EmbedPoolClient 
      pool={pool} 
      buttonColor={buttonColor}
      theme={theme}
    />
  );
}

