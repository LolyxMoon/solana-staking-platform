import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

function getEncryptionKey() {
  return process.env.HELPDESK_ENCRYPTION_KEY!;
}

async function validateSession(request: NextRequest) {
  const supabase = getSupabase();
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { data: session } = await supabase
    .from('helpdesk_admin_sessions')
    .select('admin_id, expires_at')
    .eq('token_hash', tokenHash)
    .single();

  if (!session || new Date(session.expires_at) < new Date()) return null;

  const { data: admin } = await supabase
    .from('helpdesk_admins')
    .select('id, display_name, role')
    .eq('id', session.admin_id)
    .single();

  return admin;
}

function encryptMessage(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = Buffer.from(getEncryptionKey(), 'hex');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'base64');
  encrypted += cipher.final('base64');
  
  return {
    encrypted,
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64')
  };
}

function decryptMessage(encrypted: string, iv: string, authTag: string): string {
  try {
    const key = Buffer.from(getEncryptionKey(), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '[Decryption failed]';
  }
}

export async function GET(request: NextRequest) {
  const admin = await validateSession(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabase();
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    const { data: messages, error } = await supabase
      .from('helpdesk_messages')
      .select(`
        *,
        admin:helpdesk_admins(id, display_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }

    const decryptedMessages = (messages || []).map(msg => ({
      id: msg.id,
      sender_type: msg.sender_type,
      content: decryptMessage(msg.encrypted_content, msg.iv, msg.auth_tag),
      message_type: msg.message_type,
      created_at: msg.created_at,
      admin: msg.admin
    }));

    return NextResponse.json({ messages: decryptedMessages });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await validateSession(request) as any;
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabase();
    const { conversationId, content } = await request.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'conversationId and content required' }, { status: 400 });
    }

    const { encrypted, iv, authTag } = encryptMessage(content);

    const { data: message, error } = await supabase
      .from('helpdesk_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'admin',
        admin_id: admin.id,
        encrypted_content: encrypted,
        iv,
        auth_tag: authTag,
        message_type: 'text',
        is_read: true
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to send' }, { status: 500 });
    }

    await supabase
      .from('helpdesk_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        status: 'pending'
      })
      .eq('id', conversationId);

    return NextResponse.json({ message: { ...message, content } });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
