import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await validateSession(request) as any;
  if (!admin || admin.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabase();
    const { email, password, display_name, avatar_url, role } = await request.json();
    const targetId = params.id;

    const updates: any = { updated_at: new Date().toISOString() };
    if (email) updates.email = email;
    if (display_name) updates.display_name = display_name;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (role) updates.role = role;

    if (password) {
      const { data: hash } = await supabase.rpc('hash_password', { password });
      updates.password_hash = hash;
    }

    const { error } = await supabase
      .from('helpdesk_admins')
      .update(updates)
      .eq('id', targetId);

    if (error) {
      return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await validateSession(request) as any;
  if (!admin || admin.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = getSupabase();
  const targetId = params.id;

  if (targetId === admin.id) {
    return NextResponse.json({ error: "Can't delete yourself" }, { status: 400 });
  }

  const { data: target } = await supabase
    .from('helpdesk_admins')
    .select('role')
    .eq('id', targetId)
    .single();

  if (target?.role === 'owner') {
    return NextResponse.json({ error: "Can't delete an owner" }, { status: 400 });
  }

  try {
    const { error } = await supabase
      .from('helpdesk_admins')
      .delete()
      .eq('id', targetId);

    if (error) {
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
