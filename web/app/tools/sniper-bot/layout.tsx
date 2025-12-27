import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Solana Sniper Bot | SPT Telegram Trading Bot",
  description: "Be first to buy new Solana token launches. Our Telegram sniper bot monitors Raydium and Meteora for new liquidity pools and executes trades in milliseconds. Anti-rug protection included.",
  keywords: [
    "Solana sniper bot",
    "Telegram trading bot",
    "Raydium sniper",
    "Meteora sniper", 
    "Solana trading bot",
    "token launch sniper",
    "SOL sniper bot",
    "crypto sniper bot",
    "new token alerts",
    "Solana DeFi bot"
  ],
  openGraph: {
    title: "Solana Sniper Bot | SPT Telegram Trading Bot",
    description: "Be first to buy new Solana token launches. Lightning fast execution with anti-rug protection.",
    url: "https://stakepoint.app/tools/sniper-bot",
    siteName: "StakePoint",
    images: [
      {
        url: "/og-sniper-bot.png",
        width: 1200,
        height: 630,
        alt: "SPT Sniper Bot - Solana Token Launch Sniper",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Solana Sniper Bot | SPT Telegram Trading Bot",
    description: "Be first to buy new Solana token launches. Lightning fast execution with anti-rug protection.",
    images: ["/og-sniper-bot.png"],
  },
  alternates: {
    canonical: "https://stakepoint.app/tools/sniper-bot",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function SniperBotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}