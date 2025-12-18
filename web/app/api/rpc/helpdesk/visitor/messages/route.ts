/**
 * StakePoint Helpdesk - Visitor Messages API
 * Receives plaintext, encrypts SERVER-SIDE
 * Encryption key never touches the browser
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { encryptMessage, decryptMessage } from '@/lib/helpdesk/encryption.server';
import { rateLimit, RATE_LIMITS } from '@/lib/helpdesk/rate-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// GET - Fetch messages for visitor
export async function GET(request: NextRequest) {
  const visitorUUID = request.headers.get('x-visitor-uuid');
  
  if (!visitorUUID) {
    return NextResponse.json({ error: 'Visitor UUID required' }, { status: 400 });
  }

  // Rate limit
  const rateLimited = rateLimit(request, RATE_LIMITS.api);
  if (rateLimited) return rateLimited;

  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId required' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { 'x-visitor-uuid': visitorUUID } }
    });

    // Verify visitor owns this conversation
    const { data: conversation } = await supabase
      .from('helpdesk_conversations')
      .select('id, visitor:helpdesk_visitors!inner(visitor_uuid)')
      .eq('id', conversationId)
      .single();

    if (!conversation || (conversation.visitor as any)?.visitor_uuid !== visitorUUID) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Fetch messages
    const { data: messages, error } = await supabase
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

    if (error) {
      console.error('Fetch messages error:', error);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // Decrypt messages server-side
    const decryptedMessages = (messages || []).map((msg) => {
      try {
        const content = decryptMessage(msg.encrypted_content, msg.iv, msg.auth_tag);
        return {
          id: msg.id,
          sender_type: msg.sender_type,
          content,
          message_type: msg.message_type,
          created_at: msg.created_at,
          admin: msg.admin
        };
      } catch {
        return {
          id: msg.id,
          sender_type: msg.sender_type,
          content: '[Unable to load message]',
          message_type: msg.message_type,
          created_at: msg.created_at,
          admin: msg.admin
        };
      }
    });

    return NextResponse.json({ messages: decryptedMessages });
  } catch (error) {
    console.error('Get messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Send a message (plaintext in, encrypted storage)
export async function POST(request: NextRequest) {
  const visitorUUID = request.headers.get('x-visitor-uuid');
  
  if (!visitorUUID) {
    return NextResponse.json({ error: 'Visitor UUID required' }, { status: 400 });
  }

  // Rate limit message sending
  const rateLimited = rateLimit(request, RATE_LIMITS.messageSend);
  if (rateLimited) return rateLimited;

  try {
    const { conversationId, content } = await request.json();

    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'Message content required' }, { status: 400 });
    }

    // Sanitize content (basic XSS prevention)
    const sanitizedContent = content
      .trim()
      .slice(0, 5000) // Max 5000 chars
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

    if (!sanitizedContent) {
      return NextResponse.json({ error: 'Invalid message content' }, { status: 400 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { 'x-visitor-uuid': visitorUUID } }
    });

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
      // Rate limit conversation creation
      const convRateLimited = rateLimit(request, RATE_LIMITS.conversationCreate);
      if (convRateLimited) return convRateLimited;

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
        console.error('Create conversation error:', convError);
        return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 });
      }

      targetConversationId = newConv.id;
    } else {
      // Verify visitor owns conversation
      const { data: conv } = await supabase
        .from('helpdesk_conversations')
        .select('id, visitor_id')
        .eq('id', conversationId)
        .eq('visitor_id', visitor.id)
        .single();

      if (!conv) {
        return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
      }
    }

    // ENCRYPT SERVER-SIDE
    const { encrypted, iv, authTag } = encryptMessage(sanitizedContent);

    // Insert encrypted message
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
      console.error('Insert message error:', msgError);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    // Update conversation
    await supabase
      .from('helpdesk_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        unread_count: supabase.rpc('increment_unread', { conv_id: targetConversationId }) // or just increment manually
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
