// app/page.tsx
import { Metadata } from "next";
import LandingPage from '../components/LandingPage';

export const metadata: Metadata = {
  title: "StakePoint - Solana Staking & DeFi Platform",
  description: "Stake your Solana tokens and earn industry-leading APYs. Flexible lock periods, instant rewards, and reflection tokens. Join thousands earning passive income.",
  keywords: "solana, staking, defi, crypto, rewards, apy, blockchain, passive income",
  metadataBase: new URL('https://stakepoint.app'),
  openGraph: {
    title: "StakePoint - Solana Staking & DeFi Platform",
    description: "The most advanced staking platform on Solana. Earn passive income with high APYs.",
    type: "website",
    url: 'https://stakepoint.app',
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
    title: "StakePoint - Solana Staking & DeFi Platform",
    description: "The most advanced staking platform on Solana. Earn passive income with high APYs.",
    images: ['/og-image.png'],
  },
};

export default LandingPage;