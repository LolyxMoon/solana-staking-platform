import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const ENCRYPTION_KEY = process.env.HELPDESK_ENCRYPTION_KEY!;

function encryptMessage(plaintext: string): { encrypted: string; iv: string; authTag: string } {
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
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
    const key = Buffer.from(ENCRYPTION_KEY, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(authTag, 'base64'));
    
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '[Unable to load message]';
  }
}

export async function GET(request: NextRequest) {
  const visitorUUID = request.headers.get('x-visitor-uuid');
  
  if (!visitorUUID) {
    return NextResponse.json({ error: 'Visitor UUID required' }, { status: 400 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    // Verify visitor owns conversation
    const { data: visitor } = await supabase
      .from('helpdesk_visitors')
      .select('id')
      .eq('visitor_uuid', visitorUUID)
      .single();

    if (!visitor) {
      return NextResponse.json({ error: 'Visitor not found' }, { status: 404 });
    }

    const { data: conversation } = await supabase
      .from('helpdesk_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('visitor_id', visitor.id)
      .single();

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Fetch messages
    const { data: messages } = await supabase
      .from('helpdesk_messages')
      .select(`
        id,
        sender_type,
        encrypted_content,
        iv,
        auth_tag,
        message_type,
        created_at,
        admin:helpdesk_admins(display_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    // Decrypt messages
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
  const visitorUUID = request.headers.get('x-visitor-uuid');
  
  if (!visitorUUID) {
    return NextResponse.json({ error: 'Visitor UUID required' }, { status: 400 });
  }

  try {
    const { conversationId, content } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 });
    }

    const sanitizedContent = content.trim().slice(0, 5000);
    if (!sanitizedContent) {
      return NextResponse.json({ error: 'Invalid message content' }, { status: 400 });
    }

    // Get visitor
    const { data: visitor } = await supabase
      .from('helpdesk_visitors')
      .select('id')
      .eq('visitor_uuid', visitorUUID)
      .single();

    if (!visitor) {
      return NextResponse.json({ error: 'Visitor not found' }, { status: 404 });
    }

    let targetConversationId = conversationId;

    // Create conversation if needed
    if (!targetConversationId) {
      const { data: newConv, error: convError } = await supabase
        .from('helpdesk_conversations')
        .insert({
          visitor_id: visitor.id,
          status: 'open',
          subject: sanitizedContent.slice(0, 100)
        })
        .select('id')
        .single();

      if (convError) {
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
      }

      targetConversationId = newConv.id;
    } else {
      // Verify visitor owns conversation
      const { data: conv } = await supabase
        .from('helpdesk_conversations')
        .select('id')
        .eq('id', conversationId)
        .eq('visitor_id', visitor.id)
        .single();

      if (!conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }

    // Encrypt message
    const { encrypted, iv, authTag } = encryptMessage(sanitizedContent);

    // Insert message
    const { data: message, error: msgError } = await supabase
      .from('helpdesk_messages')
      .insert({
        conversation_id: targetConversationId,
        sender_type: 'visitor',
        encrypted_content: encrypted,
        iv,
        auth_tag: authTag,
        message_type: 'text'
      })
      .select('id, created_at')
      .single();

    if (msgError) {
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    // Update conversation
    await supabase
      .from('helpdesk_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: supabase.rpc ? 1 : 1, // Simplified
        status: 'open'
      })
      .eq('id', targetConversationId);

    return NextResponse.json({
      success: true,
      conversationId: targetConversationId,
      messageId: message.id,
      createdAt: message.created_at
    });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
