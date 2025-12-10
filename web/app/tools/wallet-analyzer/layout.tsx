import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solana Wallet Analyzer | Portfolio Tracker & PnL Insights",
  description: "Free Solana wallet analyzer with real-time portfolio tracking, PnL calculations, and 24h change monitoring. Track your crypto performance instantly.",
  keywords: [
    "Solana wallet analyzer",
    "Solana portfolio tracker",
    "PnL tracking Solana",
    "crypto wallet checker",
    "Solana wallet tracker",
    "portfolio breakdown",
    "24h changes tracker",
    "DeFi portfolio tracker",
    "wallet analytics Solana"
  ],
  openGraph: {
    title: "Solana Wallet Analyzer | Portfolio & PnL Tracker",
    description: "Free wallet analyzer for Solana. Track portfolio value, monitor 24h changes, and analyze your PnL.",
    url: "https://stakepoint.app/tools/wallet-analyzer",
  },
  alternates: {
    canonical: "https://stakepoint.app/tools/wallet-analyzer",
  },
};

export default function WalletAnalyzerLayout({ children }: { children: React.ReactNode }) {
  return children;
}