import { Metadata } from "next";
import DocsClient from "./DocsClient";

export const metadata: Metadata = {
  title: "Solana Staking Guide - How to Stake & Earn Rewards",
  description: "Complete guide to staking Solana and SPL tokens. Learn how to stake tokens, create staking pools, earn high APY rewards, understand lock periods, and manage your crypto investments securely on Solana's best staking platform.",
  keywords: "solana staking, how to stake solana, spl token staking, create staking pool, solana staking guide, defi staking, crypto rewards, high apy staking, token-2022 staking",
  openGraph: {
    title: "Complete Solana Staking Guide - StakePoint Documentation",
    description: "Learn everything about staking on Solana - from beginner basics to advanced pool management. Earn high APY rewards on SPL tokens.",
    type: "article",
  },
  twitter: {
    card: "summary_large_image",
    title: "Complete Solana Staking Guide",
    description: "Learn how to stake Solana tokens and earn passive income with StakePoint.",
  },
};

export default function DocsPage() {
  return <DocsClient />;
}