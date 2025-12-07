import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function verifySignature(wallet: string, message: string, signature: string): Promise<boolean> {
  try {
    const nacl = (await import('tweetnacl')).default;
    const bs58 = (await import('bs58')).default;
    
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(wallet);
    
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
  if (!(await verifySignature(wallet, message, signature))) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (!(await isWhaleMember(wallet))) {
    return NextResponse.json({ error: 'Not a Whale Club member' }, { status: 403 });
  }

  try {
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
    if (!(await verifySignature(wallet, signMessage, signature))) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

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