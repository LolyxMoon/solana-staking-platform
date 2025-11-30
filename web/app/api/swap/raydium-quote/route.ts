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

    console.log('🔍 Searching for Raydium pool...', { inputMint, outputMint, amount });

    // Raydium API v3 endpoint
    const poolInfoUrl = `https://api-v3.raydium.io/pools/info/mint?` +
      `mint1=${inputMint}&` +
      `mint2=${outputMint}&` +
      `poolType=standard&` +
      `poolSortField=liquidity&` +
      `sortType=desc&` +
      `pageSize=10&` +
      `page=1`;
    
    console.log('📡 Fetching:', poolInfoUrl);
    
    const poolsResponse = await fetch(poolInfoUrl);
    
    if (!poolsResponse.ok) {
      const errorText = await poolsResponse.text();
      console.error('❌ Raydium API HTTP error:', poolsResponse.status, errorText);
      throw new Error(`Raydium API returned ${poolsResponse.status}: ${errorText}`);
    }

    const poolsData = await poolsResponse.json();
    
    // Log the ENTIRE response to debug structure
    console.log('📦 Full API Response:', JSON.stringify(poolsData, null, 2));
    console.log('📦 Response keys:', Object.keys(poolsData));
    console.log('📦 Response.success:', poolsData.success);
    console.log('📦 Response.data type:', typeof poolsData.data);
    console.log('📦 Response.data:', poolsData.data);

    // Handle different possible response structures
    let pools = [];
    
    // Structure 1: { success: true, data: { data: [...] } }
    if (poolsData.success && poolsData.data?.data && Array.isArray(poolsData.data.data)) {
      pools = poolsData.data.data;
      console.log('✅ Found pools in data.data:', pools.length);
    }
    // Structure 2: { success: true, data: [...] }
    else if (poolsData.success && Array.isArray(poolsData.data)) {
      pools = poolsData.data;
      console.log('✅ Found pools in data:', pools.length);
    }
    // Structure 3: Direct array
    else if (Array.isArray(poolsData)) {
      pools = poolsData;
      console.log('✅ Found pools in root:', pools.length);
    }
    // Structure 4: { data: [...] } without success field
    else if (poolsData.data && Array.isArray(poolsData.data)) {
      pools = poolsData.data;
      console.log('✅ Found pools in data (no success field):', pools.length);
    }
    else {
      console.error('❌ Unexpected response structure');
      console.error('Response:', JSON.stringify(poolsData, null, 2));
      return NextResponse.json(
        { 
          error: "Unexpected API response structure",
          debug: {
            keys: Object.keys(poolsData),
            dataType: typeof poolsData.data,
            hasSuccess: 'success' in poolsData,
            successValue: poolsData.success,
          }
        },
        { status: 500 }
      );
    }

    // Check if we found any pools
    if (pools.length === 0) {
      console.error('❌ No pools found in response');
      return NextResponse.json(
        { error: "No Raydium pool found for this pair" },
        { status: 404 }
      );
    }

    const pool = pools[0];
    
    // Log pool structure to verify fields
    console.log('🏊 First pool structure:', JSON.stringify(pool, null, 2));
    console.log('🏊 Pool keys:', Object.keys(pool));
    
    // Verify pool has required fields
    if (!pool.id) {
      console.error('❌ Pool missing id field');
      console.error('Available fields:', Object.keys(pool));
      return NextResponse.json(
        { 
          error: "Pool data missing required fields",
          debug: {
            poolKeys: Object.keys(pool),
            poolSample: JSON.stringify(pool).slice(0, 500)
          }
        },
        { status: 500 }
      );
    }

    console.log('✅ Found pool:', pool.id);

    // Extract pool data with safe fallbacks
    const mintA = pool.mintA || pool.baseMint;
    const mintB = pool.mintB || pool.quoteMint;
    
    if (!mintA || !mintB) {
      console.error('❌ Pool missing mint information');
      return NextResponse.json(
        { error: "Pool data incomplete" },
        { status: 500 }
      );
    }

    // Determine which side is input
    const inputIsA = mintA.address === inputMint;
    
    // Get reserves - handle different possible field names
    const reserveIn = parseFloat(
      inputIsA 
        ? (pool.mintAmountA || pool.baseReserve || pool.lpReserve?.baseReserve || '0')
        : (pool.mintAmountB || pool.quoteReserve || pool.lpReserve?.quoteReserve || '0')
    );
    const reserveOut = parseFloat(
      inputIsA 
        ? (pool.mintAmountB || pool.quoteReserve || pool.lpReserve?.quoteReserve || '0')
        : (pool.mintAmountA || pool.baseReserve || pool.lpReserve?.baseReserve || '0')
    );
    
    const decimalsIn = inputIsA ? mintA.decimals : mintB.decimals;
    const decimalsOut = inputIsA ? mintB.decimals : mintA.decimals;
    
    console.log('💰 Pool data:', {
      reserveIn,
      reserveOut,
      decimalsIn,
      decimalsOut,
      inputIsA,
    });

    // Validate reserves
    if (reserveIn === 0 || reserveOut === 0) {
      console.error('❌ Invalid pool reserves:', { reserveIn, reserveOut });
      return NextResponse.json(
        { error: "Pool has no liquidity" },
        { status: 400 }
      );
    }
    
    // Calculate quote
    const amountInDecimal = parseFloat(amount) / Math.pow(10, decimalsIn);
    
    // CPMM formula with fee (usually 0.25% for standard pools)
    const feeRate = pool.feeRate || pool.tradeFeeRate || 0.0025;
    const amountInWithFee = amountInDecimal * (1 - feeRate);
    const amountOutDecimal = (amountInWithFee * reserveOut) / (reserveIn + amountInWithFee);
    
    // Apply slippage tolerance
    const slippage = parseFloat(slippageBps) / 10000;
    const minAmountOutDecimal = amountOutDecimal * (1 - slippage);
    
    // Convert to raw amounts (lamports/smallest unit)
    const outAmount = (amountOutDecimal * Math.pow(10, decimalsOut)).toFixed(0);
    const minOutAmount = (minAmountOutDecimal * Math.pow(10, decimalsOut)).toFixed(0);
    
    // Calculate price impact
    const priceImpact = (amountInDecimal / reserveIn) * 100;

    console.log('📊 Quote calculated:', { 
      amountInDecimal, 
      amountOutDecimal, 
      outAmount,
      priceImpact: priceImpact.toFixed(4),
      feeRate,
    });

    return NextResponse.json({
      inputMint,
      outputMint,
      inAmount: amount,
      outAmount: outAmount.toString(),
      otherAmountThreshold: minOutAmount.toString(),
      poolId: pool.id,
      poolType: pool.type || pool.poolType || 'standard',
      source: 'raydium',
      priceImpactPct: parseFloat(priceImpact.toFixed(4)),
      marketInfos: [
        {
          id: pool.id,
          label: 'Raydium CPMM',
          inputMint,
          outputMint,
          inAmount: amount,
          outAmount: outAmount.toString(),
          priceImpactPct: parseFloat(priceImpact.toFixed(4)),
          lpFee: {
            amount: (amountInDecimal * feeRate * Math.pow(10, decimalsIn)).toFixed(0),
            mint: inputMint,
            pct: feeRate * 100,
          },
        },
      ],
    });

  } catch (error: any) {
    console.error("❌ Raydium quote error:", error);
    console.error("Stack:", error.stack);
    
    return NextResponse.json(
      { 
        error: error.message || "Failed to get Raydium quote",
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}