import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Token Safety Checker - Rug Pull Detection",
  description: "Free Solana token safety checker. Detect rug pulls, analyze mint authority, check freeze authority, and verify token legitimacy before buying.",
  keywords: [
    "Solana token safety",
    "rug pull detector",
    "token scam checker",
    "Solana rug checker",
    "mint authority checker",
    "freeze authority Solana",
    "token legitimacy check",
    "honeypot detector Solana",
    "safe token scanner",
    "Solana token analyzer"
  ],
  openGraph: {
    title: "Solana Token Safety Checker | Rug Pull Detection",
    description: "Free token safety tool. Check mint authority, freeze authority, and detect potential rug pulls before investing.",
    url: "https://stakepoint.app/tools/token-safety",
  },
  alternates: {
    canonical: "https://stakepoint.app/tools/token-safety",
  },
};

export default function TokenSafetyLayout({ children }: { children: React.ReactNode }) {
  return children;
}