/**
 * StakePoint Helpdesk - Mark Conversation as Read API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/helpdesk/supabase';
import { validateAdminSession } from '@/lib/helpdesk/admin-auth';

// POST - Mark conversation as read
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { admin, error } = await validateAdminSession(request);
  if (error) return error;

  try {
    const { id } = params;
    const supabase = createAdminClient();

    // Reset unread count
    await supabase
      .from('helpdesk_conversations')
      .update({ unread_count: 0 })
      .eq('id', id);

    // Mark all messages as read
    await supabase
      .from('helpdesk_messages')
      .update({ is_read: true })
      .eq('conversation_id', id)
      .eq('sender_type', 'visitor');

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
