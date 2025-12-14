export default function StructuredData() {
  const websiteData = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "StakePoint",
    "url": "https://stakepoint.app",
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://stakepoint.app/pools?search={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };

  const organizationData = {
    "@context": "https://schema.org",
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
  };

  const siteNavigation = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SiteNavigationElement",
        "name": "Staking Pools",
        "url": "https://stakepoint.app/pools"
      },
      {
        "@type": "SiteNavigationElement",
        "name": "Token Swap",
        "url": "https://stakepoint.app/swap"
      },
      {
        "@type": "SiteNavigationElement",
        "name": "Solana Tools",
        "url": "https://stakepoint.app/tools"
      },
      {
        "@type": "SiteNavigationElement",
        "name": "Dashboard",
        "url": "https://stakepoint.app/dashboard"
      },
      {
        "@type": "SiteNavigationElement",
        "name": "Documentation",
        "url": "https://stakepoint.app/docs"
      }
    ]
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteNavigation) }}
      />
    </>
  );
}