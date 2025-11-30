import { prisma } from "@/lib/prisma";
import LPPoolsClient from "./LPPoolsClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Farming Pools",
  description: "Browse available LP Farming Pools",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type LPPool = {
  id: string;
  poolId: number;
  tokenMint: string;
  name: string;
  symbol: string;
  type: "locked" | "unlocked";
  lockPeriod?: number | null;
  apr?: number | null;
  apy?: number | null;
  totalStaked: number;
  rewards?: string | null;
  logo?: string | null;
  hidden?: boolean;
  featured?: boolean;
  isLPPool?: boolean;
  rewardTokenMint?: string | null;
  rewardTokenSymbol?: string | null;
};

async function getLPPools(): Promise<LPPool[]> {
  try {
    const pools = await prisma.pool.findMany({
      where: {
        hidden: false,
        isPaused: false,
        isLPPool: true, // ✅ Only LP pools
        type: {
          in: ['locked', 'unlocked']
        }
      },
      orderBy: [
        { featured: 'desc' },
        { symbol: 'asc' },
        { poolId: 'asc' }
      ]
    });
    
    return pools as LPPool[];
  } catch (error) {
    console.error('Database error:', error);
    return [];
  }
}

export default async function LPPoolsPage() {
  const pools = await getLPPools();
  
  return (
    <div className="p-3 sm:p-4 lg:p-6 pt-16 lg:pt-6">
      <LPPoolsClient pools={pools} />
    </div>
  );
}