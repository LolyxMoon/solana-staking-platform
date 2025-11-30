import { prisma } from "@/lib/prisma";
import PoolsClient from "./PoolsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staking Pools",
  description: "Browse available staking pools",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Pool = {
  id: string;
  poolId: number; // ✅ NEW: Pool number (0, 1, 2...)
  tokenMint: string; // ✅ NEW: Replaces mintAddress
  name: string;
  symbol: string;
  type: "locked" | "unlocked";
  lockPeriod?: number | null;
  apr?: number | null;
  apy?: number | null;
  totalStaked: number;
  rewards?: string | null;
  logo?: string | null;
  pairAddress?: string | null;
  hidden?: boolean;
  featured?: boolean;
  hasSelfReflections?: boolean;
  hasExternalReflections?: boolean;
  externalReflectionMint?: string | null;
  reflectionTokenAccount?: string | null;
  reflectionTokenSymbol?: string | null;
};

async function getPools(): Promise<Pool[]> {
  try {
    const pools = await prisma.pool.findMany({
      where: {
        hidden: false,
        isPaused: false,
        isLPPool: false,
        // Ensure we only show staking pools, not locks
        type: {
          in: ['locked', 'unlocked']
        }
      },
      orderBy: [
        { featured: 'desc' },
        { symbol: 'asc' }, // Group same tokens together
        { poolId: 'asc' } // Then by pool number
      ]
    });
    
    return pools as Pool[];
  } catch (error) {
    console.error('Database error:', error);
    return [];
  }
}

export default async function PoolsPage() {
  const pools = await getPools();
  
  return (
    <div className="p-3 sm:p-4 lg:p-6 pt-16 lg:pt-6">
      <PoolsClient pools={pools} />
    </div>
  );
}