/**
 * StakePoint Helpdesk - Individual Admin Management API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/helpdesk/supabase';
import { validateAdminSession, requireOwner } from '@/lib/helpdesk/admin-auth';

// PATCH - Update admin
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { admin, error } = await validateAdminSession(request);
  if (error) return error;

  const ownerError = requireOwner(admin!);
  if (ownerError) return ownerError;

  try {
    const { id } = params;
    const { email, password, displayName, avatarUrl, role, isActive } = await request.json();

    const supabase = createAdminClient();

    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString()
    };

    if (email) updateData.email = email;
    if (displayName) updateData.display_name = displayName;
    if (avatarUrl !== undefined) updateData.avatar_url = avatarUrl || null;
    if (role) updateData.role = role;
    if (isActive !== undefined) updateData.is_active = isActive;

    // Update password if provided
    if (password) {
      const { data: hashedPassword } = await supabase
        .rpc('hash_password', { password });
      updateData.password_hash = hashedPassword;
    }

    const { error: updateError } = await supabase
      .from('helpdesk_admins')
      .update(updateData)
      .eq('id', id);

    if (updateError) {
      console.error('Update admin error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update admin' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete admin
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { admin, error } = await validateAdminSession(request);
  if (error) return error;

  const ownerError = requireOwner(admin!);
  if (ownerError) return ownerError;

  try {
    const { id } = params;

    // Prevent deleting self
    if (id === admin!.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // Check if trying to delete an owner
    const { data: targetAdmin } = await supabase
      .from('helpdesk_admins')
      .select('role')
      .eq('id', id)
      .single();

    if (targetAdmin?.role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot delete owner accounts' },
        { status: 400 }
      );
    }

    // Delete sessions first
    await supabase
      .from('helpdesk_admin_sessions')
      .delete()
      .eq('admin_id', id);

    // Delete admin
    const { error: deleteError } = await supabase
      .from('helpdesk_admins')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Delete admin error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete admin' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete admin error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
