import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Token & LP Locker - Secure Liquidity Locks",
  description: "Free Solana token locker to lock LP tokens and SPL tokens. Secure liquidity locking for Raydium, Meteora & more. Build investor trust, prevent rug pulls, and show locked liquidity on DexScreener.",
  keywords: [
    "Solana token locker",
    "LP locker Solana",
    "lock liquidity Solana",
    "Solana liquidity locker",
    "lock LP tokens Raydium",
    "SPL token locker",
    "token vesting Solana",
    "prevent rug pull Solana",
    "Raydium LP lock",
    "Meteora liquidity lock",
    "lock tokens Solana",
    "liquidity lock tool",
    "Streamflow alternative",
    "Smithii locker alternative",
    "UNCX Solana alternative",
    "SOLocker alternative",
    "DexScreener locked liquidity",
    "token lock certificate",
    "Solana vesting tool",
    "lock memecoin liquidity"
  ],
  openGraph: {
    title: "Solana Token & LP Locker | Lock Liquidity & Build Trust",
    description: "Free token locker for Solana. Lock LP tokens from Raydium & Meteora. Prevent rug pulls, build investor confidence, and display locked liquidity on DexScreener.",
    url: "https://stakepoint.app/locks",
    siteName: "StakePoint",
    type: "website",
    images: [
      {
        url: "/og/token-locker.jpg",
        width: 1200,
        height: 630,
        alt: "StakePoint Token Locker - Lock LP & SPL Tokens on Solana",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Solana Token Locker | Lock LP & Prevent Rug Pulls",
    description: "Lock your LP tokens and SPL tokens on Solana. Build trust with investors, prevent rug pulls, and show locked liquidity on DexScreener. Free to use.",
    images: ["/og/token-locker.jpg"],
  },
  alternates: {
    canonical: "https://stakepoint.app/locks",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function LocksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}