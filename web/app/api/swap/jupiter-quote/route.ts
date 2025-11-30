// app/api/swap/jupiter-quote/route.ts
// Jupiter quote endpoint - supports ALL tokens including low-liquidity

import { NextRequest, NextResponse } from 'next/server';

const JUPITER_QUOTE_API = 'https://quote-api.jup.ag/v6';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const inputMint = searchParams.get('inputMint');
    const outputMint = searchParams.get('outputMint');
    const amount = searchParams.get('amount');
    const slippageBps = searchParams.get('slippageBps') || '50';

    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log('🪐 Jupiter quote request:', {
      inputMint: inputMint.slice(0, 8) + '...',
      outputMint: outputMint.slice(0, 8) + '...',
      amount,
    });

    // Get quote from Jupiter
    const quoteParams = new URLSearchParams({
      inputMint,
      outputMint,
      amount,
      slippageBps,
      onlyDirectRoutes: 'false', // ✅ Allow routing through Raydium pools
    });

    const quoteUrl = `${JUPITER_QUOTE_API}/quote?${quoteParams}`;
    const quoteResponse = await fetch(quoteUrl);

    if (!quoteResponse.ok) {
      const errorText = await quoteResponse.text();
      console.error('❌ Jupiter quote failed:', errorText);
      
      return NextResponse.json(
        { error: 'Unable to get quote from Jupiter' },
        { status: quoteResponse.status }
      );
    }

    const quoteData = await quoteResponse.json();

    console.log('✅ Jupiter quote OK');
    console.log('📊 Output:', quoteData.outAmount);
    console.log('📊 Route:', quoteData.routePlan?.map((r: any) => r.swapInfo?.label).join(' → '));

    // Return standardized format
    return NextResponse.json({
      inputMint,
      outputMint,
      inAmount: amount,
      outAmount: quoteData.outAmount,
      otherAmountThreshold: quoteData.otherAmountThreshold,
      swapMode: quoteData.swapMode,
      slippageBps: parseInt(slippageBps),
      priceImpactPct: quoteData.priceImpactPct,
      routePlan: quoteData.routePlan,
      contextSlot: quoteData.contextSlot,
      timeTaken: quoteData.timeTaken,
      source: 'jupiter',
    });

  } catch (error: any) {
    console.error('❌ Quote error:', error.message);
    
    return NextResponse.json(
      { error: error.message || 'Failed to get quote' },
      { status: 500 }
    );
  }
}