import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solana Holder Snapshot | Token Holder List & Analytics",
  description: "Free Solana holder snapshot tool. Get a complete list of all token holders with balances and percentages. Export to CSV for airdrops. Perfect for token analytics and community insights.",
  keywords: [
    "Solana holder snapshot",
    "token holder list",
    "SPL token holders",
    "Solana token analytics",
    "holder distribution",
    "token holder export",
    "airdrop snapshot",
    "Solana holder checker",
    "token holder CSV",
    "wallet snapshot Solana",
    "holder percentage",
    "top holders Solana",
    "token distribution analysis",
    "Solana token scanner"
  ],
  openGraph: {
    title: "Solana Holder Snapshot | Token Holder Analytics",
    description: "Free tool to snapshot all token holders on Solana. Get wallet addresses, balances, and percentages. Export for airdrops.",
    url: "https://stakepoint.app/tools/snapshot",
    siteName: "StakePoint",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Solana Holder Snapshot Tool",
    description: "Get a complete list of all token holders with balances. Export to CSV for airdrops. Free to use.",
  },
  alternates: {
    canonical: "https://stakepoint.app/tools/snapshot",
  },
};

export default function SnapshotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}