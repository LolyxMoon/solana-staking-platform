import { prisma } from "@/lib/prisma";
import LocksClient from "./LocksClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Token Locks",
  description: "Lock your tokens for a specified duration and track unlock progress",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Lock = {
  id: string;
  lockId: number;
  tokenMint: string;
  name: string;
  symbol: string;
  amount: number;
  lockDuration: number;
  unlockTime: Date;
  creatorWallet: string;
  logo: string | null;
  isActive: boolean;
  isUnlocked: boolean;
  createdAt: Date;
};

async function getLocks(): Promise<Lock[]> {
  try {
    const locks = await prisma.lock.findMany({
      where: {
        isActive: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return locks as Lock[];
  } catch (error) {
    console.error('Database error:', error);
    return [];
  }
}

export default async function LocksPage() {
  const locks = await getLocks();
  
  return (
    <div className="p-3 sm:p-4 lg:p-6 pt-16 lg:pt-6">
      <LocksClient locks={locks} />
    </div>
  );
}


