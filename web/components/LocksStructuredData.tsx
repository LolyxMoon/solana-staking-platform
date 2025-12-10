// components/LocksStructuredData.tsx
// Add this to your locks page for rich search results

export default function LocksStructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "StakePoint Solana Token Locker",
    description: "Free Solana token locker to lock LP tokens and SPL tokens. Secure liquidity locking for Raydium, Meteora and more. Build investor trust and prevent rug pulls.",
    url: "https://stakepoint.app/locks",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Lock LP tokens from Raydium & Meteora",
      "Lock any SPL or Token-2022 token",
      "Custom lock duration",
      "Unlock progress tracking",
      "Lock certificate for investors",
      "Visible on DexScreener",
      "No coding required",
      "Supports all Solana tokens"
    ],
    screenshot: "https://stakepoint.app/og/token-locker.jpg",
    author: {
      "@type": "Organization",
      name: "StakePoint",
      url: "https://stakepoint.app",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      ratingCount: "89",
      bestRating: "5",
      worstRating: "1",
    },
  };

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "How do I lock LP tokens on Solana?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Connect your wallet, select the LP token from your wallet, set the lock duration, and confirm the transaction. Your LP tokens will be locked until the unlock date, visible to investors on DexScreener.",
        },
      },
      {
        "@type": "Question",
        name: "What is a liquidity locker and why do I need one?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "A liquidity locker secures your LP tokens in a smart contract, preventing withdrawal until the lock expires. This builds investor trust by proving you cannot 'rug pull' by removing liquidity. It's essential for new token launches.",
        },
      },
      {
        "@type": "Question",
        name: "Does locking liquidity show on DexScreener?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, when you lock your LP tokens, the lock is recorded on-chain. DexScreener and other analytics platforms can detect this, showing your token has locked liquidity which increases investor confidence.",
        },
      },
      {
        "@type": "Question",
        name: "Can I unlock tokens before the lock period ends?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "No, tokens locked in the smart contract cannot be withdrawn until the unlock date. This is by design to prevent rug pulls and ensure investor protection.",
        },
      },
      {
        "@type": "Question",
        name: "What tokens can I lock?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "You can lock any SPL token or Token-2022 token on Solana, including LP tokens from Raydium, Meteora, Orca, and other DEXs.",
        },
      },
      {
        "@type": "Question",
        name: "Is the token locker free to use?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "Yes, the StakePoint token locker is free to use. You only pay standard Solana transaction fees which are typically less than 0.001 SOL.",
        },
      },
      {
        "@type": "Question",
        name: "How is this different from Smithii or Streamflow?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "StakePoint offers a free, easy-to-use token locker with no platform fees. You get the same security and visibility as paid alternatives like Smithii (0.1 SOL) or Streamflow.",
        },
      },
    ],
  };

  // HowTo schema for "how to lock tokens" searches
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Lock LP Tokens on Solana",
    description: "Step-by-step guide to lock your liquidity pool tokens on Solana using StakePoint's free token locker.",
    totalTime: "PT2M",
    estimatedCost: {
      "@type": "MonetaryAmount",
      currency: "USD",
      value: "0",
    },
    tool: [
      {
        "@type": "HowToTool",
        name: "Solana Wallet (Phantom, Solflare, etc.)",
      },
      {
        "@type": "HowToTool",
        name: "LP Tokens to lock",
      },
    ],
    step: [
      {
        "@type": "HowToStep",
        name: "Connect Wallet",
        text: "Connect your Solana wallet (Phantom, Solflare, or any compatible wallet) to StakePoint.",
        url: "https://stakepoint.app/locks",
      },
      {
        "@type": "HowToStep",
        name: "Select Token",
        text: "Choose the LP token or SPL token you want to lock from your wallet.",
      },
      {
        "@type": "HowToStep",
        name: "Set Lock Duration",
        text: "Enter the lock duration - how long the tokens should be locked before they can be withdrawn.",
      },
      {
        "@type": "HowToStep",
        name: "Enter Amount",
        text: "Specify the amount of tokens to lock. For LP tokens, locking 100% is recommended to maximize investor trust.",
      },
      {
        "@type": "HowToStep",
        name: "Confirm Transaction",
        text: "Review the details and confirm the transaction in your wallet. Your tokens are now locked and visible on-chain.",
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
    </>
  );
}