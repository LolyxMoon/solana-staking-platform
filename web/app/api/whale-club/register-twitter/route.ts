import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

async function supabaseGet(table: string, query: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    headers: { 'apikey': key!, 'Authorization': `Bearer ${key}` },
  });
  return response.json();
}

async function supabaseInsert(table: string, data: any) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const response = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: {
      'apikey': key!,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

async function supabaseUpdate(table: string, query: string, data: any) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: {
      'apikey': key!,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
    body: JSON.stringify(data),
  });
  return response.json();
}

export async function POST(request: NextRequest) {
  try {
    const { wallet, twitterUsername } = await request.json();

    if (!wallet || !twitterUsername) {
      return NextResponse.json({ error: 'Wallet and Twitter username required' }, { status: 400 });
    }

    // Clean username (remove @ if present)
    const cleanUsername = twitterUsername.replace('@', '').trim().toLowerCase();

    if (!cleanUsername || cleanUsername.length < 1 || cleanUsername.length > 15) {
      return NextResponse.json({ error: 'Invalid Twitter username' }, { status: 400 });
    }

    // Check if username is already taken by another wallet
    const existing = await supabaseGet(
      'whale_club_users',
      `twitter_username=ilike.${cleanUsername}&wallet_address=neq.${wallet}&select=wallet_address`
    );

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: 'Username already registered to another wallet' }, { status: 400 });
    }

    // Check if user exists
    const userExists = await supabaseGet(
      'whale_club_users',
      `wallet_address=eq.${wallet}&select=wallet_address`
    );

    if (userExists && userExists.length > 0) {
      // Update existing user
      await supabaseUpdate('whale_club_users', `wallet_address=eq.${wallet}`, {
        twitter_username: cleanUsername,
        updated_at: new Date().toISOString(),
      });
    } else {
      // Insert new user
      await supabaseInsert('whale_club_users', {
        wallet_address: wallet,
        twitter_username: cleanUsername,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      success: true,
      twitterUsername: cleanUsername,
    });
  } catch (error) {
    console.error('Register Twitter error:', error);
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}