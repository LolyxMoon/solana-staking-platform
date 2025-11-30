// app/page.tsx
import { Metadata } from "next";
import LandingPage from '../components/LandingPage';

export const metadata: Metadata = {
  title: "StakePoint - Stake Your Crypto & Earn Rewards | Solana Staking Platform",
  description: "Stake your Solana tokens and earn industry-leading APYs. Flexible lock periods, instant rewards, and reflection tokens. Join thousands earning passive income.",
  keywords: "solana, staking, defi, crypto, rewards, apy, blockchain, passive income",
  metadataBase: new URL('https://solanastaking-seven.vercel.app'),
  openGraph: {
    title: "StakePoint - Stake Your Crypto & Earn Rewards | Solana Staking Platform",
    description: "The most advanced staking platform on Solana. Earn passive income with high APYs.",
    type: "website",
    url: 'https://solanastaking-seven.vercel.app',
    images: [{ 
      url: '/og-image.png',
      width: 1200,
      height: 630,
      alt: 'StakePoint - Advanced Solana Staking Platform',
      type: 'image/png'
    }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StakePoint - Stake Your Crypto & Earn Rewards | Solana Staking Platform",
    description: "The most advanced staking platform on Solana. Earn passive income with high APYs.",
    images: ['/og-image.png'],
  },
};

export default LandingPage;