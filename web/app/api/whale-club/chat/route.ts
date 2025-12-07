import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import nacl from 'tweetnacl';
import bs58 from 'bs58';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// Encryption helpers
const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const key = process.env.CHAT_ENCRYPTION_KEY;
  if (!key || key.length !== 64) {
    throw new Error('CHAT_ENCRYPTION_KEY must be 64 hex characters');
  }
  return Buffer.from(key, 'hex');
}

function encrypt(text: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedData: string): string {
  const key = getKey();
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Signature verification
function verifyWalletSignature(wallet: string, message: string, signature: string): boolean {
  try {
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);
    const publicKeyBytes = bs58.decode(wallet);
    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
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

// GET messages
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
  if (!verifyWalletSignature(wallet, message, signature)) {
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

// POST new message
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
    if (!verifyWalletSignature(wallet, signMessage, signature)) {
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

    return NextResponse.json({ 
      success: true, 
      message: { ...data, message: cleanMessage }
    });
  } catch (error) {
    console.error('Error posting message:', error);
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 });
  }
}