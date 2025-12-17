// Create this as: app/api/test-jupiter/route.ts
// Then visit: http://localhost:3000/api/test-jupiter

import { NextResponse } from "next/server";

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: {},
  };

  // Test 1: Can we reach Jupiter?
  console.log('🧪 Testing Jupiter API accessibility...');
  
  const SOL = 'So11111111111111111111111111111111111111112';
  const USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
  
  try {
    const quoteUrl = `https://lite-api.jup.ag/swap/v1/quote?` +
      `inputMint=${SOL}&` +
      `outputMint=${USDC}&` +
      `amount=1000000000&` +
      `slippageBps=50`;

    console.log('📡 Fetching:', quoteUrl);

    const startTime = Date.now();
    const response = await fetch(quoteUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    });
    const endTime = Date.now();

    console.log('📥 Response status:', response.status);
    console.log('⏱️  Response time:', endTime - startTime, 'ms');

    results.tests.jupiter_quote = {
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      responseTime: endTime - startTime,
      headers: Object.fromEntries(response.headers.entries()),
    };

    if (response.ok) {
      const data = await response.json();
      results.tests.jupiter_quote.data = {
        inAmount: data.inAmount,
        outAmount: data.outAmount,
        priceImpactPct: data.priceImpactPct,
      };
      console.log('✅ Jupiter quote successful!');
      console.log('- Out amount:', data.outAmount);
    } else {
      const errorText = await response.text();
      results.tests.jupiter_quote.error = errorText;
      console.log('❌ Jupiter quote failed:', errorText);
    }

  } catch (error: any) {
    results.tests.jupiter_quote = {
      success: false,
      error: error.message,
      stack: error.stack,
      code: error.code,
    };
    console.log('❌ Jupiter fetch error:', error.message);
  }

  // Test 2: Can we reach Raydium?
  try {
    const raydiumUrl = 'https://api-v3.raydium.io/pools/info/mint?' +
      `mint1=${SOL}&mint2=${USDC}&poolType=standard&pageSize=1`;

    console.log('📡 Testing Raydium API...');

    const startTime = Date.now();
    const response = await fetch(raydiumUrl);
    const endTime = Date.now();

    results.tests.raydium_api = {
      success: response.ok,
      status: response.status,
      responseTime: endTime - startTime,
    };

    if (response.ok) {
      const data = await response.json();
      results.tests.raydium_api.poolsFound = data.data?.data?.length || 0;
      console.log('✅ Raydium API accessible');
    } else {
      console.log('❌ Raydium API failed');
    }

  } catch (error: any) {
    results.tests.raydium_api = {
      success: false,
      error: error.message,
    };
    console.log('❌ Raydium fetch error:', error.message);
  }

  // Test 3: DNS Resolution
  results.tests.dns = {
    jupiter_lite_api: 'lite-api.jup.ag',
    raydium_api: 'api-v3.raydium.io',
    note: 'If fetch fails, check DNS resolution and network connectivity',
  };

  // Summary
  results.summary = {
    jupiter_working: results.tests.jupiter_quote?.success || false,
    raydium_working: results.tests.raydium_api?.success || false,
    recommendation: '',
  };

  if (results.summary.jupiter_working) {
    results.summary.recommendation = '✅ Jupiter is working! Use Jupiter for swaps.';
  } else if (results.summary.raydium_working) {
    results.summary.recommendation = '⚠️ Jupiter failed but Raydium works. Consider implementing Raydium swaps or debugging Jupiter network issues.';
  } else {
    results.summary.recommendation = '❌ Both APIs failed. Check network connectivity and firewall settings.';
  }

  console.log('\n' + '='.repeat(60));
  console.log('DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  console.log('Jupiter:', results.summary.jupiter_working ? '✅ Working' : '❌ Failed');
  console.log('Raydium:', results.summary.raydium_working ? '✅ Working' : '❌ Failed');
  console.log(results.summary.recommendation);
  console.log('='.repeat(60) + '\n');

  return NextResponse.json(results, {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}