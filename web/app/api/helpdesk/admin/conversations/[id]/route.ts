import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

async function validateSession(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.substring(7);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  const { data: session } = await supabase
    .from('helpdesk_admin_sessions')
    .select('admin_id, expires_at, admin:helpdesk_admins(id, display_name, role)')
    .eq('token_hash', tokenHash)
    .single();

  if (!session || new Date(session.expires_at) < new Date()) return null;
  return session.admin;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await validateSession(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { status, priority, assigned_admin_id } = await request.json();
    const conversationId = params.id;

    const updates: any = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (priority) updates.priority = priority;
    if (assigned_admin_id !== undefined) updates.assigned_admin_id = assigned_admin_id;

    const { error } = await supabase
      .from('helpdesk_conversations')
      .update(updates)
      .eq('id', conversationId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
