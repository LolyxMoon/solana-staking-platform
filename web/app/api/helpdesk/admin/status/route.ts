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
  return session.admin_id;
}

export async function POST(request: NextRequest) {
  const adminId = await validateSession(request);
  if (!adminId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabase();
    const { isOnline } = await request.json();

    await supabase
      .from('helpdesk_admins')
      .update({ 
        is_online: isOnline,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', adminId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabase();
    
    const { data } = await supabase
      .from('helpdesk_admins')
      .select('is_online')
      .eq('is_online', true)
      .eq('is_active', true)
      .limit(1);

    return NextResponse.json({ anyOnline: (data?.length || 0) > 0 });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}