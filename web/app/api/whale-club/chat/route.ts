import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encrypt, decrypt } from '@/lib/encryption';
import { verifyWalletSignature, isSignatureValid } from '@/lib/verify-wallet';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Verify user is whale club member
async function isWhaleMember(wallet: string): Promise<boolean> {
  const { data } = await supabase
    .from('whale_club_users')
    .select('wallet_address')
    .eq('wallet_address', wallet)
    .single();
  
  return !!data;
}

// GET messages (requires signature)
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  const signature = request.nextUrl.searchParams.get('signature');
  const timestamp = request.nextUrl.searchParams.get('timestamp');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

  // Validate required params
  if (!wallet || !signature || !timestamp) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Verify signature is recent (5 min)
  const ts = parseInt(timestamp);
  if (!isSignatureValid(ts)) {
    return NextResponse.json({ error: 'Signature expired' }, { status: 401 });
  }

  // Verify signature
  const message = `WhaleChat:${wallet}:${timestamp}`;
  if (!verifyWalletSignature(wallet, message, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // Verify whale membership
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

    // Decrypt messages
    const decryptedMessages = (data || []).map(msg => ({
      ...msg,
      message: decrypt(msg.message)
    })).reverse();

    return NextResponse.json({ messages: decryptedMessages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

// POST new message (requires signature)
export async function POST(request: NextRequest) {
  try {
    const { wallet, nickname, message, signature, timestamp } = await request.json();

    // Validate required params
    if (!wallet || !message?.trim() || !signature || !timestamp) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify signature is recent (5 min)
    if (!isSignatureValid(timestamp)) {
      return NextResponse.json({ error: 'Signature expired' }, { status: 401 });
    }

    // Verify signature
    const signMessage = `WhaleChat:${wallet}:${timestamp}`;
    if (!verifyWalletSignature(wallet, signMessage, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    // Verify whale membership
    const { data: user } = await supabase
      .from('whale_club_users')
      .select('wallet_address, nickname')
      .eq('wallet_address', wallet)
      .single();

    if (!user) {
      return NextResponse.json({ error: 'Not a Whale Club member' }, { status: 403 });
    }

    // Sanitize and encrypt message
    const cleanMessage = message.trim().slice(0, 500);
    const encryptedMessage = encrypt(cleanMessage);

    const { data, error } = await supabase
      .from('whale_club_messages')
      .insert({
        wallet_address: wallet,
        nickname: nickname || user.nickname,
        message: encryptedMessage
      })
      .select()
      .single();

    if (error) throw error;

    // Return decrypted for immediate display
    return NextResponse.json({ 
      success: true, 
      message: {
        ...data,
        message: cleanMessage // Return decrypted for sender
      }
    });
  } catch (error) {
    console.error('Error posting message:', error);
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 });
  }
}