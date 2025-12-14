export default function StructuredData() {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "StakePoint",
    "description": "The most advanced staking platform on Solana. Earn passive income with industry-leading APYs, flexible lock periods, and reflection rewards.",
    "url": "https://stakepoint.app",
    "applicationCategory": "FinanceApplication",
    "operatingSystem": "Web Browser",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "provider": {
      "@type": "Organization",
      "name": "StakePoint",
      "url": "https://stakepoint.app",
      "logo": "https://stakepoint.app/favicon.jpg",
      "sameAs": [
        "https://twitter.com/StakePointApp",
        "https://t.me/StakePointPortal"
      ],
      "contactPoint": {
        "@type": "ContactPoint",
        "email": "contact@stakepoint.app",
        "contactType": "Customer Support",
        "availableLanguage": ["English"]
      }
    },
    "featureList": [
      "Stake SOL and SPL tokens",
      "Earn passive income",
      "Flexible lock periods",
      "Create custom staking pools",
      "Reflection rewards",
      "Token swap integration",
      "Real-time APY tracking"
    ]
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}