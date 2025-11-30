export async function fetchTokenUsdPrice(
  chain: string,
  tokenAddress: string
): Promise<number> {
  try {
    // First try tokens endpoint
    let url = `https://api.dexscreener.com/latest/dex/tokens/${chain}/${tokenAddress}`;
    let res = await fetch(url, { next: { revalidate: 60 } });
    let data = await res.json();

    console.log("Dexscreener /tokens response:", tokenAddress, data);

    // If no pairs, fallback to search
    if (!data.pairs || data.pairs.length === 0) {
      url = `https://api.dexscreener.com/latest/dex/search?q=${tokenAddress}`;
      res = await fetch(url, { next: { revalidate: 60 } });
      data = await res.json();

      console.log("Dexscreener /search response:", tokenAddress, data);
    }

    if (data.pairs && data.pairs.length > 0) {
      const bestPair = data.pairs.sort(
        (a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
      )[0];
      if (bestPair?.priceUsd) {
        return parseFloat(bestPair.priceUsd);
      }
    }

    console.warn("⚠️ No price found for:", tokenAddress);
    return 0;
  } catch (e) {
    console.error("DexScreener fetch error:", e);
    return 0;
  }
}
