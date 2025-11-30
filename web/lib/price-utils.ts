// Fetch token price in USD from Jupiter Price API
export async function getTokenPriceUSD(mintAddress: string): Promise<number> {
  try {
    // Jupiter Price API v2
    const response = await fetch(
      `https://api.jup.ag/price/v2?ids=${mintAddress}`
    );
    
    if (!response.ok) {
      console.warn(`Failed to fetch price for ${mintAddress}`);
      return 0;
    }

    const data = await response.json();
    
    // Jupiter returns: { data: { [mintAddress]: { price: number } } }
    const price = data.data?.[mintAddress]?.price;
    
    if (typeof price === 'number') {
      return price;
    }
    
    console.warn(`No price data for ${mintAddress}`);
    return 0;
  } catch (error) {
    console.error(`Error fetching price for ${mintAddress}:`, error);
    return 0;
  }
}

// Calculate USD volume for a swap
export async function calculateSwapVolumeUSD(
  tokenMint: string,
  tokenAmount: number,
  tokenDecimals: number
): Promise<{ volumeUsd: number; priceUsd: number }> {
  const priceUsd = await getTokenPriceUSD(tokenMint);
  
  if (priceUsd === 0) {
    return { volumeUsd: 0, priceUsd: 0 };
  }
  
  // Convert from lamports to actual token amount
  const actualAmount = tokenAmount / Math.pow(10, tokenDecimals);
  
  // Calculate USD value
  const volumeUsd = actualAmount * priceUsd;
  
  return { volumeUsd, priceUsd };
}