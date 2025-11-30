import { Metadata } from "next";
import { PrismaClient } from "@prisma/client";
import LandingPage from "@/components/LandingPage";

const prisma = new PrismaClient();

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://solanastaking-seven.vercel.app';
  const ogImageUrl = `${baseUrl}/og-image.png?v=${Date.now()}`;
  
  try {
    const seo = await prisma.sEO.findUnique({
      where: { page: "landing" },
    });

    if (seo) {
      return {
        title: seo.title,
        description: seo.description,
        keywords: seo.keywords || undefined,
        metadataBase: new URL(baseUrl),
        openGraph: {
          title: seo.ogTitle || seo.title,
          description: seo.ogDescription || seo.description,
          images: seo.ogImage ? [{ url: seo.ogImage, width: 1200, height: 630, alt: 'StakePoint' }] : [{ url: ogImageUrl, width: 1200, height: 630, alt: 'StakePoint' }],
          type: "website",
          url: baseUrl,
        },
        twitter: {
          card: (seo.twitterCard as any) || "summary_large_image",
          title: seo.twitterTitle || seo.title,
          description: seo.twitterDescription || seo.description,
          images: seo.twitterImage ? [seo.twitterImage] : [ogImageUrl],
        },
        alternates: {
          canonical: seo.canonicalUrl || undefined,
        },
      };
    }
  } catch (error) {
    console.error("Failed to fetch SEO data:", error);
  }

  // Default metadata if no SEO data found
  return {
    title: "StakePoint - Stake Your Crypto & Earn Rewards | Solana Staking Platform",
    description: "Stake your Solana tokens and earn industry-leading APYs. Flexible lock periods, instant rewards, and reflection tokens. Join thousands earning passive income.",
    keywords: "solana, staking, defi, crypto, rewards, apy, blockchain, passive income",
    metadataBase: new URL(baseUrl),
    openGraph: {
      title: "StakePoint - Stake Your Crypto & Earn Rewards | Solana Staking Platform",
      description: "The most advanced staking platform on Solana. Earn passive income with high APYs.",
      type: "website",
      url: baseUrl,
      images: [{ 
        url: ogImageUrl,
        width: 1200,
        height: 630,
        alt: 'StakePoint - Advanced Solana Staking Platform'
      }],
    },
    twitter: {
      card: "summary_large_image",
      title: "StakePoint - Stake Your Crypto & Earn Rewards | Solana Staking Platform",
      description: "The most advanced staking platform on Solana. Earn passive income with high APYs.",
      images: [ogImageUrl],
    },
  };
}

export default function LandingPageRoute() {
  return <LandingPage />;
}