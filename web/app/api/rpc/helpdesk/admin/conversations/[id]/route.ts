/**
 * StakePoint Helpdesk - Single Conversation API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/helpdesk/supabase';
import { validateAdminSession } from '@/lib/helpdesk/admin-auth';

// PATCH - Update conversation
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { admin, error } = await validateAdminSession(request);
  if (error) return error;

  try {
    const { id } = params;
    const body = await request.json();
    const { status, priority, assigned_admin_id } = body;

    const supabase = createAdminClient();

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (status) updateData.status = status;
    if (priority) updateData.priority = priority;
    if (assigned_admin_id !== undefined) updateData.assigned_admin_id = assigned_admin_id;

    const { error: updateError } = await supabase
      .from('helpdesk_conversations')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Update conversation error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update conversation' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Conversation update error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
