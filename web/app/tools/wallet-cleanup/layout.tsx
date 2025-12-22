import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Wallet Cleanup - Burn Dust & Reclaim SOL",
  description: "Free Solana wallet cleanup tool. Burn dust tokens under $1, close empty token accounts, and reclaim ~0.002 SOL per account. Clean your wallet and recover locked SOL instantly.",
  keywords: [
    "Solana wallet cleanup",
    "burn dust tokens",
    "reclaim SOL rent",
    "close empty accounts",
    "Solana token burner",
    "clean Solana wallet",
    "remove spam tokens",
    "recover locked SOL",
    "Sol incinerator alternative",
    "burn unwanted tokens Solana"
  ],
  openGraph: {
    title: "Solana Wallet Cleanup | Burn Tokens & Reclaim SOL",
    description: "Free tool to clean your Solana wallet. Burn dust tokens, close empty accounts, and reclaim ~0.002 SOL per account.",
    url: "https://stakepoint.app/tools/wallet-cleanup",
  },
  alternates: {
    canonical: "https://stakepoint.app/tools/wallet-cleanup",
  },
};

export default function WalletCleanupLayout({ children }: { children: React.ReactNode }) {
  return children;
}