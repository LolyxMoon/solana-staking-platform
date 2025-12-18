/**
 * StakePoint Helpdesk - Secure Messages API
 * Server-side encryption only
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/helpdesk/supabase';
import { validateAdminSession } from '@/lib/helpdesk/admin-auth';
import { encryptMessage, decryptMessages } from '@/lib/helpdesk/encryption.server';
import { rateLimit, RATE_LIMITS } from '@/lib/helpdesk/rate-limit';
import { logAuditFromRequest } from '@/lib/helpdesk/audit';

// GET - List messages for a conversation
export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminSession(request);
  if (error) return error;

  const rateLimited = rateLimit(request, RATE_LIMITS.api);
  if (rateLimited) return rateLimited;

  try {
    const { searchParams } = new URL(request.url);
    const conversationId = searchParams.get('conversationId');

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: messages, error: fetchError } = await supabase
      .from('helpdesk_messages')
      .select(`
        *,
        admin:helpdesk_admins(id, display_name, avatar_url)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Fetch messages error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
    }

    // Decrypt messages server-side
    const decryptedMessages = decryptMessages(messages || []);

    return NextResponse.json({ messages: decryptedMessages });
  } catch (error) {
    console.error('Messages error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Send a message
export async function POST(request: NextRequest) {
  const { admin, error } = await validateAdminSession(request);
  if (error) return error;

  const rateLimited = rateLimit(request, RATE_LIMITS.messageSend);
  if (rateLimited) return rateLimited;

  try {
    const { conversationId, content } = await request.json();

    if (!conversationId || !content) {
      return NextResponse.json({ error: 'conversationId and content are required' }, { status: 400 });
    }

    // Encrypt server-side
    const { encrypted, iv, authTag } = encryptMessage(content);

    const supabase = createAdminClient();

    const { data: message, error: insertError } = await supabase
      .from('helpdesk_messages')
      .insert({
        conversation_id: conversationId,
        sender_type: 'admin',
        admin_id: admin!.id,
        encrypted_content: encrypted,
        iv,
        auth_tag: authTag,
        message_type: 'text',
        is_read: true
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert message error:', insertError);
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
    }

    // Update conversation
    await supabase
      .from('helpdesk_conversations')
      .update({
        last_message_at: new Date().toISOString(),
        status: 'pending'
      })
      .eq('id', conversationId);

    // Audit log
    await logAuditFromRequest(request, {
      action: 'message.sent',
      adminId: admin!.id,
      targetId: conversationId,
      targetType: 'conversation'
    });

    return NextResponse.json({ message: { ...message, content } });
  } catch (error) {
    console.error('Send message error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
