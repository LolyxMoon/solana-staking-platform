import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solana Tools | Wallet Cleanup, Portfolio Analyzer & Airdrop Tool",
  description: "Free Solana tools suite: Clean your wallet by burning dust tokens, analyze portfolio with PnL tracking, and airdrop tokens to multiple wallets. Essential utilities for Solana users.",
  keywords: [
    "Solana tools",
    "Solana wallet tools",
    "crypto utilities Solana",
    "Solana DeFi tools",
    "wallet management tools",
    "SPL token tools",
    "Solana utilities free",
    "blockchain tools Solana",
    "crypto wallet utilities",
    "Solana ecosystem tools"
  ],
  openGraph: {
    title: "Solana Tools | Free Wallet Utilities by StakePoint",
    description: "Essential Solana tools: Wallet cleanup, portfolio analyzer, and airdrop tool. Manage your crypto with free, powerful utilities.",
    url: "https://stakepoint.app/tools",
    siteName: "StakePoint",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Solana Tools | Free Wallet Utilities",
    description: "Wallet cleanup, portfolio analyzer, and airdrop tool for Solana. Free utilities to manage your crypto.",
  },
  alternates: {
    canonical: "https://stakepoint.app/tools",
  },
};

export default function ToolsLayout({ children }: { children: React.ReactNode }) {
  return children;
}