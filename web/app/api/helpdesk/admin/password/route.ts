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
    .select('id, email, display_name, role')
    .eq('id', session.admin_id)
    .single();

  return admin;
}

export async function POST(request: NextRequest) {
  const admin = await validateSession(request);
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = getSupabase();
    const { currentPassword, newPassword } = await request.json();

    if (!currentPassword || !newPassword) {
      return NextResponse.json({ error: 'Both passwords are required' }, { status: 400 });
    }

    if (newPassword.length < 8) {
      return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
    }

    // Verify current password
    const { data: authResult, error: authError } = await supabase.rpc('authenticate_admin', {
      p_email: admin.email,
      p_password: currentPassword
    });

    if (authError || !authResult || authResult.length === 0) {
      return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });
    }

    // Update password using bcrypt
    const { error: updateError } = await supabase.rpc('update_admin_password', {
      p_admin_id: admin.id,
      p_new_password: newPassword
    });

    if (updateError) {
      console.error('Password update error:', updateError);
      return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Password change error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
