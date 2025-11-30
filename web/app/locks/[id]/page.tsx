import { prisma } from "@/lib/prisma";
import LockDetailClient from "./LockDetailClient";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Props = {
  params: { id: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const lock = await prisma.lock.findUnique({
      where: { id: params.id },
    });

    if (!lock) {
      return {
        title: "Lock Not Found",
      };
    }

    return {
      title: `${lock.name} Lock | StakePoint`,
      description: `Lock details for ${lock.amount} ${lock.symbol}. Unlock time: ${new Date(lock.unlockTime).toLocaleDateString()}`,
    };
  } catch (error) {
    return {
      title: "Lock Details",
    };
  }
}

async function getLock(id: string) {
  try {
    const lock = await prisma.lock.findUnique({
      where: { id },
    });

    return lock;
  } catch (error) {
    console.error('Database error:', error);
    return null;
  }
}

export default async function LockDetailPage({ params }: Props) {
  const lock = await getLock(params.id);

  if (!lock) {
    notFound();
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 pt-16 lg:pt-6">
      <LockDetailClient lock={lock} />
    </div>
  );
}


