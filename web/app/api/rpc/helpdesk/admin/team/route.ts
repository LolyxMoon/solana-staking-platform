/**
 * StakePoint Helpdesk - Team Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/helpdesk/supabase';
import { validateAdminSession, requireOwner } from '@/lib/helpdesk/admin-auth';

// GET - List all admins
export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminSession(request);
  if (error) return error;

  const ownerError = requireOwner(admin!);
  if (ownerError) return ownerError;

  try {
    const supabase = createAdminClient();

    const { data: admins, error: fetchError } = await supabase
      .from('helpdesk_admins')
      .select('id, email, display_name, avatar_url, role, is_active, is_online, last_seen_at, created_at')
      .order('created_at', { ascending: true });

    if (fetchError) {
      console.error('Fetch admins error:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch admins' },
        { status: 500 }
      );
    }

    return NextResponse.json({ admins });
  } catch (error) {
    console.error('Team error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create new admin
export async function POST(request: NextRequest) {
  const { admin, error } = await validateAdminSession(request);
  if (error) return error;

  const ownerError = requireOwner(admin!);
  if (ownerError) return ownerError;

  try {
    const { email, password, displayName, avatarUrl, role } = await request.json();

    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: 'Email, password, and display name are required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check if email already exists
    const { data: existing } = await supabase
      .from('helpdesk_admins')
      .select('id')
      .eq('email', email)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'An admin with this email already exists' },
        { status: 400 }
      );
    }

    // Create admin using the function
    const { data: newAdminId, error: createError } = await supabase
      .rpc('create_admin', {
        p_email: email,
        p_password: password,
        p_display_name: displayName,
        p_avatar_url: avatarUrl || null,
        p_role: role || 'agent'
      });

    if (createError) {
      console.error('Create admin error:', createError);
      return NextResponse.json(
        { error: 'Failed to create admin' },
        { status: 500 }
      );
    }

    return NextResponse.json({ adminId: newAdminId });
  } catch (error) {
    console.error('Create admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
