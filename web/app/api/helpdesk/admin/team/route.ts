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

export async function GET(request: NextRequest) {
  const admin = await validateSession(request) as any;
  if (!admin || admin.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: admins, error } = await supabase
      .from('helpdesk_admins')
      .select('id, email, display_name, avatar_url, role, is_active, is_online, last_seen_at')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
    }

    return NextResponse.json({ admins });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = await validateSession(request) as any;
  if (!admin || admin.role !== 'owner') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { email, password, display_name, avatar_url, role } = await request.json();

    if (!email || !password || !display_name) {
      return NextResponse.json({ error: 'Email, password, and display_name required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('create_admin', {
      p_email: email,
      p_password: password,
      p_display_name: display_name,
      p_avatar_url: avatar_url || null,
      p_role: role || 'agent'
    });

    if (error) {
      if (error.message.includes('duplicate')) {
        return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Failed to create admin' }, { status: 500 });
    }

    return NextResponse.json({ adminId: data });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
