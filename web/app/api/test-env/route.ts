import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    DATABASE_URL: process.env.DATABASE_URL ? 'EXISTS' : 'MISSING',
    DIRECT_URL: process.env.DIRECT_URL ? 'EXISTS' : 'MISSING',
    firstChars: process.env.DATABASE_URL?.substring(0, 15) || 'N/A'
  });
}
