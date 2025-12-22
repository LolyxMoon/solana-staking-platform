import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SPT Token - StakePoint Native Token",
  description: "Buy, sell, and stake SPT - the native utility token of StakePoint. Fair launch on Solana with 0% team allocation. Stake SPT to earn rewards and join the Whale Club.",
  keywords: [
    "SPT token",
    "StakePoint token",
    "Solana staking token",
    "SPT crypto",
    "buy SPT",
    "stake SPT",
    "DeFi token Solana",
  ],
  openGraph: {
    title: "SPT Token - StakePoint Native Token",
    description: "Buy, sell, and stake SPT - the native utility token of StakePoint. Fair launch with 0% team allocation.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SPT Token - StakePoint",
    description: "Buy, sell, and stake SPT - the native utility token of StakePoint.",
  },
};

export default function SPTLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}