import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
    }

    const { data, error } = await supabase.rpc('authenticate_admin', {
      p_email: email,
      p_password: password
    });

    if (error || !data || data.length === 0) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const admin = data[0];

    const sessionToken = crypto.randomBytes(32).toString('hex');
    const refreshToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(sessionToken).digest('hex');
    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const { error: insertError } = await supabase.from('helpdesk_admin_sessions').insert({
      admin_id: admin.admin_id,
      token_hash: tokenHash,
      refresh_token_hash: refreshHash,
      expires_at: expiresAt.toISOString(),
      refresh_expires_at: refreshExpiresAt.toISOString(),
      ip_address: request.headers.get('x-forwarded-for') || 'unknown',
      user_agent: request.headers.get('user-agent') || 'unknown'
    });

    if (insertError) {
      console.error('Session insert error:', insertError);
      return NextResponse.json({ error: 'Session creation failed', debug: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      adminId: admin.admin_id,
      displayName: admin.display_name,
      avatarUrl: admin.avatar_url,
      role: admin.role,
      sessionToken,
      refreshToken,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error', debug: error.message }, { status: 500 });
  }
}
