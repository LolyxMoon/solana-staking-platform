import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solana Airdrop Tool | Bulk Token Sender & Multi-Wallet Distribution",
  description: "Free Solana airdrop tool for batch token transfers. Send SPL tokens to multiple wallets via CSV upload. Multi-recipient distribution with automatic ATA creation.",
  keywords: [
    "Solana airdrop tool",
    "token multisender Solana",
    "bulk token transfer",
    "batch airdrop Solana",
    "CSV wallet airdrop",
    "SPL token distribution",
    "Solana bulk sender",
    "Smithii alternative",
    "send tokens multiple wallets"
  ],
  openGraph: {
    title: "Solana Airdrop Tool | Bulk Token Sender",
    description: "Free airdrop tool for Solana. Send tokens to hundreds of wallets in batches. CSV upload or manual entry.",
    url: "https://stakepoint.app/tools/airdrop",
  },
  alternates: {
    canonical: "https://stakepoint.app/tools/airdrop",
  },
};

export default function AirdropLayout({ children }: { children: React.ReactNode }) {
  return children;
}