import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const inputMint = searchParams.get('inputMint');
    const outputMint = searchParams.get('outputMint');
    const amount = searchParams.get('amount');
    const slippageBps = searchParams.get('slippageBps') || '50';
    
    if (!inputMint || !outputMint || !amount) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 }
      );
    }
    
    // STEP 1: Try Jupiter first (best for high liquidity)
    let quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?` +
      `inputMint=${inputMint}&` +
      `outputMint=${outputMint}&` +
      `amount=${amount}&` +
      `slippageBps=${slippageBps}`;
    
    console.log('🔍 Trying Jupiter first...');
    
    let response = await fetch(quoteUrl);
    
    if (response.ok) {
      const quote = await response.json();
      console.log('✅ Jupiter quote received');
      return NextResponse.json({ ...quote, source: 'jupiter' });
    }
    
    // STEP 2: Jupiter failed, try Raydium SDK
    const errorBody = await response.json();
    console.log('⚠️ Jupiter failed:', errorBody);
    
    if (errorBody.errorCode === 'TOKEN_NOT_TRADABLE') {
      console.log('🔄 Falling back to Raydium SDK...');
      
      // Call Raydium quote route
      const raydiumResponse = await fetch(
        `${request.url.replace('/api/swap/quote', '/api/swap/raydium-quote')}`,
        { headers: request.headers }
      );
      
      if (raydiumResponse.ok) {
        const raydiumQuote = await raydiumResponse.json();
        console.log('✅ Raydium quote received');
        return NextResponse.json(raydiumQuote);
      }
      
      const raydiumError = await raydiumResponse.json();
      console.error('❌ Raydium also failed:', raydiumError);
      
      return NextResponse.json(
        { error: "Token not available on Jupiter or Raydium" },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: errorBody.error || "Failed to fetch quote" },
      { status: response.status }
    );

  } catch (error) {
    console.error("Error fetching quote:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}