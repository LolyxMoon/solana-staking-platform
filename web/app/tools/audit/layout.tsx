import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solana Smart Contract Audit Tool | Security Analysis & Code Review",
  description: "Free Solana smart contract audit tool. Analyze program security, detect vulnerabilities, and review code safety before interacting with DeFi protocols.",
  keywords: [
    "Solana smart contract audit",
    "Solana security analysis",
    "program audit tool",
    "smart contract scanner",
    "Solana code review",
    "DeFi security checker",
    "vulnerability detection Solana",
    "contract security audit",
    "Solana program analyzer"
  ],
  openGraph: {
    title: "Solana Smart Contract Audit | Security Analysis Tool",
    description: "Free audit tool for Solana smart contracts. Detect vulnerabilities and review program security before interacting.",
    url: "https://stakepoint.app/tools/audit",
  },
  alternates: {
    canonical: "https://stakepoint.app/tools/audit",
  },
};

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return children;
}