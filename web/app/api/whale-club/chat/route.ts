import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function base58Decode(str: string): Uint8Array {
  const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  const bytes: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const index = ALPHABET.indexOf(str[i]);
    if (index === -1) throw new Error('Invalid base58 character');
    let carry = index;
    for (let j = 0; j < bytes.length; j++) {
      carry += bytes[j] * 58;
      bytes[j] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  for (let i = 0; i < str.length && str[i] === '1'; i++) {
    bytes.push(0);
  }
  return new Uint8Array(bytes.reverse());
}

function verifySignature(wallet: string, message: string, signature: string): boolean {
  try {
    const nacl = require('tweetnacl');
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = base58Decode(signature);
    const publicKeyBytes = base58Decode(wallet);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

function isSignatureValid(timestamp: number): boolean {
  return Math.abs(Date.now() - timestamp) <= 5 * 60 * 1000;
}

async function isWhaleMember(wallet: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('whale_club_users')
    .select('wallet_address')
    .eq('wallet_address', wallet)
    .single();
  return !!data;
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  const signature = request.nextUrl.searchParams.get('signature');
  const timestamp = request.nextUrl.searchParams.get('timestamp');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

  if (!wallet || !signature || !timestamp) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!isSignatureValid(parseInt(timestamp))) {
    return NextResponse.json({ error: 'Signature expired' }, { status: 401 });
  }

  const message = `WhaleChat:${wallet}:${timestamp}`;
  if (!verifySignature(wallet, message, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (!(await isWhaleMember(wallet))) {
    return NextResponse.json({ error: 'Not a Whale Club member' }, { status: 403 });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('whale_club_messages')
      .select('id, wallet_address, nickname, message, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return NextResponse.json({ messages: (data || []).reverse() });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { wallet, nickname, message, signature, timestamp } = await request.json();

    if (!wallet || !message?.trim() || !signature || !timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isSignatureValid(timestamp)) {
      return NextResponse.json({ error: 'Signature expired' }, { status: 401 });
    }

    const signMessage = `WhaleChat:${wallet}:${timestamp}`;
    if (!verifySignature(wallet, signMessage, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const supabase = getSupabase();
    const { data: user } = await supabase
      .from('whale_club_users')
      .select('wallet_address, nickname')
      .eq('wallet_address', wallet)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'Not a Whale Club member' }, { status: 403 });
    }

    const cleanMessage = message.trim().slice(0, 500);

    const { data, error } = await supabase
      .from('whale_club_messages')
      .insert({
        wallet_address: wallet,
        nickname: nickname || user.nickname,
        message: cleanMessage
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, message: data });
  } catch (error) {
    console.error('Error posting message:', error);
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 });
  }
}