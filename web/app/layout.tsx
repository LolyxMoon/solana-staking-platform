// app/layout.tsx
import "./globals.css";
import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { SolanaWalletProvider } from "@/components/SolanaWalletProvider";
import { MobileBanner } from "@/components/MobileBanner";
import { ToastProvider } from "@/components/ToastContainer";
import { ThemeProvider } from "@/components/ThemeProvider";
import { PoolDataProvider } from "@/hooks/usePoolData";
import LayoutContent from "@/components/LayoutContent";
import StructuredData from "@/components/StructuredData";

// ✅ Use next/font instead of Google Fonts link (saves 780ms)
const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-dm-sans",
});

export const metadata: Metadata = {
  title: {
    default: "StakePoint | Advanced Solana Staking Platform",
    template: "%s | StakePoint"
  },
  description: "The most advanced staking platform on Solana. Earn passive income with industry-leading APYs, flexible lock periods, and reflection rewards. Create your own staking pools with ease.",
  keywords: [
    "Solana staking",
    "SOL staking",
    "crypto staking",
    "DeFi",
    "passive income",
    "staking rewards",
    "SPL tokens",
    "Token-2022",
    "reflection rewards",
    "Solana DeFi",
    "yield farming",
    "staking pools"
  ],
  authors: [{ name: "StakePoint" }],
  creator: "StakePoint",
  publisher: "StakePoint",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://stakepoint.app",
    siteName: "StakePoint",
    title: "StakePoint | Advanced Solana Staking Platform",
    description: "The most advanced staking platform on Solana. Earn passive income with industry-leading APYs, flexible lock periods, and reflection rewards.",
    images: [
      {
        url: "/favicon.jpg",
        width: 512,
        height: 512,
        alt: "StakePoint - Advanced Solana Staking Platform",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "StakePoint | Advanced Solana Staking Platform",
    description: "The most advanced staking platform on Solana. Earn passive income with industry-leading APYs and flexible lock periods.",
    creator: "@StakePointApp",
    images: ["/favicon.jpg"],
  },
  icons: {
    icon: [
      { url: "/favicon.jpg", type: "image/jpeg" },
    ],
    apple: [
      { url: "/favicon.jpg", type: "image/jpeg" },
    ],
  },
  manifest: "/site.webmanifest",
  metadataBase: new URL("https://stakepoint.app"),
  alternates: {
    canonical: "/",
  },
  category: "DeFi",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${dmSans.variable}`} suppressHydrationWarning>
      <head>
        {/* Google Analytics */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-GY3EL774BV"></script>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-GY3EL774BV');
            `,
          }}
        />
        {/* ✅ Preconnect to external image hosts (saves 300ms+) */}
        <link rel="preconnect" href="https://image2url.com" />
        <link rel="preconnect" href="https://cdn.dexscreener.com" />
        <link rel="preconnect" href="https://api.dexscreener.com" />
        <StructuredData />
      </head>
      <body className={`${dmSans.className} bg-[#060609] text-gray-100 min-h-screen`}>
        <ThemeProvider>
          <SolanaWalletProvider>
            <MobileBanner />
            <PoolDataProvider>
              <ToastProvider>
                <LayoutContent>{children}</LayoutContent>
              </ToastProvider>
            </PoolDataProvider>
          </SolanaWalletProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}