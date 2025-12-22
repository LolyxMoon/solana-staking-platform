import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Holder Snapshot - Token Holder Lists",
  description:
    "Take accurate snapshots of all SPL token holders on Solana. Export holder lists for airdrops, analyze distribution, track whale concentration. Powered by Helius API.",
  keywords: [
    "Solana holder snapshot",
    "token holder list",
    "airdrop snapshot tool",
    "holder distribution analysis",
    "SPL token holders",
    "whale tracking Solana",
    "token concentration",
    "bulk airdrop list",
    "Solana token analytics",
    "holder export CSV",
  ],
  openGraph: {
    title: "Holder Snapshot - Complete Token Holder Analysis",
    description:
      "Get accurate snapshots of all token holders. Export for airdrops, analyze whale concentration, track distribution.",
    type: "website",
  },
};

export default function SnapshotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}