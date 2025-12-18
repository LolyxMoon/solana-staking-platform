import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Rate limiting - simple in-memory store
const requestCounts = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 100;

// Allowed RPC methods (whitelist for security)
const ALLOWED_METHODS = [
  // Account queries
  'getAccountInfo',
  'getMultipleAccounts',
  'getMultipleAccountsInfo',
  'getParsedAccountInfo',
  'getBalance',
  'getProgramAccounts',
  'getParsedProgramAccounts',
  
  // Token queries
  'getTokenAccountBalance',
  'getTokenAccountsByOwner',
  'getParsedTokenAccountsByOwner',
  'getTokenSupply',
  'getTokenAccounts',
  
  // Transaction queries
  'getSignaturesForAddress',
  'getSignatureStatus',
  'getSignatureStatuses',
  'getTransaction',
  
  // Block/slot queries
  'getLatestBlockhash',
  'getSlot',
  'getBlockHeight',
  'getGenesisHash',
  
  // Transaction submission
  'sendTransaction',
  'sendRawTransaction',
  'simulateTransaction',
  
  // Fee queries
  'getMinimumBalanceForRentExemption',
  'getFeeForMessage',
  'getRecentPrioritizationFees',
];

function getClientIP(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
    || request.headers.get('x-real-ip') 
    || 'unknown';
}

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = requestCounts.get(ip);
  
  if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
    requestCounts.set(ip, { count: 1, timestamp: now });
    return false;
  }
  
  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }
  
  record.count++;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const clientIP = getClientIP(request);
    
    if (isRateLimited(clientIP)) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.' },
        { status: 429 }
      );
    }
    
    const body = await request.json();
    
    if (!body.method || !body.jsonrpc) {
      return NextResponse.json(
        { error: 'Invalid JSON-RPC request' },
        { status: 400 }
      );
    }
    
    if (!ALLOWED_METHODS.includes(body.method)) {
      console.log(`🚫 Blocked RPC method: ${body.method} from ${clientIP}`);
      return NextResponse.json(
        { error: `Method ${body.method} not allowed` },
        { status: 403 }
      );
    }
    
    const heliusUrl = process.env.HELIUS_RPC_URL;
    
    if (!heliusUrl) {
      console.error('HELIUS_RPC_URL not configured');
      return NextResponse.json(
        { error: 'RPC not configured' },
        { status: 500 }
      );
    }
    
    const response = await fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('RPC Proxy error:', error.message);
    return NextResponse.json(
      { error: 'RPC request failed', details: error.message },
      { status: 500 }
    );
  }
}