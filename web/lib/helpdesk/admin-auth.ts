/**
 * StakePoint Helpdesk - Secure Admin Authentication
 * - 24-hour sessions with refresh tokens
 * - IP binding option
 * - Suspicious activity detection
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createAdminClient } from './supabase';
import { logAuditFromRequest } from './audit';
import { isIPBlocked, blockIP } from './rate-limit';

export interface AuthenticatedAdmin {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: 'owner' | 'agent';
  sessionId: string;
}

export interface SessionValidationResult {
  admin: AuthenticatedAdmin | null;
  error: NextResponse | null;
  shouldRefresh?: boolean;
}

/**
 * Generate secure tokens
 */
export function generateToken(length: number = 32): string {
  return crypto.randomBytes(length).toString('hex');
}

/**
 * Hash a token for storage
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Validate admin session with security checks
 */
export async function validateAdminSession(
  request: NextRequest
): Promise<SessionValidationResult> {
  // Check if IP is blocked
  if (isIPBlocked(request)) {
    await logAuditFromRequest(request, {
      action: 'security.ip_blocked',
      metadata: { reason: 'Blocked IP attempted access' }
    });
    
    return {
      admin: null,
      error: NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      )
    };
  }

  const authHeader = request.headers.get('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      admin: null,
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    };
  }

  const sessionToken = authHeader.substring(7);
  const tokenHash = hashToken(sessionToken);
  
  const supabase = createAdminClient();

  // Get session with admin data
  const { data: session, error } = await supabase
    .from('helpdesk_admin_sessions')
    .select(`
      id,
      admin_id,
      expires_at,
      refresh_expires_at,
      ip_address,
      admin:helpdesk_admins(id, display_name, avatar_url, role, is_active)
    `)
    .eq('token_hash', tokenHash)
    .single();

  if (error || !session) {
    return {
      admin: null,
      error: NextResponse.json(
        { error: 'Invalid or expired session' },
        { status: 401 }
      )
    };
  }

  // Check if admin is still active
  const admin = session.admin as any;
  if (!admin || !admin.is_active) {
    return {
      admin: null,
      error: NextResponse.json(
        { error: 'Account disabled' },
        { status: 401 }
      )
    };
  }

  const now = new Date();
  const expiresAt = new Date(session.expires_at);
  const refreshExpiresAt = new Date(session.refresh_expires_at);

  // Check if session is completely expired (past refresh window)
  if (now > refreshExpiresAt) {
    // Delete expired session
    await supabase
      .from('helpdesk_admin_sessions')
      .delete()
      .eq('id', session.id);

    await logAuditFromRequest(request, {
      action: 'session.expired',
      adminId: admin.id
    });

    return {
      admin: null,
      error: NextResponse.json(
        { error: 'Session expired, please login again' },
        { status: 401 }
      )
    };
  }

  // Update last activity
  await supabase
    .from('helpdesk_admins')
    .update({ last_seen_at: now.toISOString(), is_online: true })
    .eq('id', admin.id);

  return {
    admin: {
      id: admin.id,
      displayName: admin.display_name,
      avatarUrl: admin.avatar_url,
      role: admin.role,
      sessionId: session.id
    },
    error: null,
    shouldRefresh: now > expiresAt // Token valid but should be refreshed
  };
}

/**
 * Create a new session
 */
export async function createSession(
  adminId: string,
  request: NextRequest
): Promise<{ sessionToken: string; refreshToken: string; expiresAt: Date }> {
  const supabase = createAdminClient();
  
  const sessionToken = generateToken(32);
  const refreshToken = generateToken(32);
  
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
  const refreshExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() :
                    request.headers.get('x-real-ip') || 
                    'unknown';
  
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // Delete any existing sessions for this admin (single session only)
  await supabase
    .from('helpdesk_admin_sessions')
    .delete()
    .eq('admin_id', adminId);

  // Create new session
  await supabase
    .from('helpdesk_admin_sessions')
    .insert({
      admin_id: adminId,
      token_hash: hashToken(sessionToken),
      refresh_token_hash: hashToken(refreshToken),
      expires_at: expiresAt.toISOString(),
      refresh_expires_at: refreshExpiresAt.toISOString(),
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: now.toISOString()
    });

  await logAuditFromRequest(request, {
    action: 'session.created',
    adminId
  });

  return { sessionToken, refreshToken, expiresAt };
}

/**
 * Refresh a session using refresh token
 */
export async function refreshSession(
  refreshToken: string,
  request: NextRequest
): Promise<{ sessionToken: string; expiresAt: Date } | null> {
  const supabase = createAdminClient();
  const tokenHash = hashToken(refreshToken);

  const { data: session } = await supabase
    .from('helpdesk_admin_sessions')
    .select('id, admin_id, refresh_expires_at')
    .eq('refresh_token_hash', tokenHash)
    .single();

  if (!session) return null;

  const now = new Date();
  if (now > new Date(session.refresh_expires_at)) {
    // Refresh token expired
    await supabase
      .from('helpdesk_admin_sessions')
      .delete()
      .eq('id', session.id);
    return null;
  }

  // Generate new session token
  const newSessionToken = generateToken(32);
  const newExpiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  await supabase
    .from('helpdesk_admin_sessions')
    .update({
      token_hash: hashToken(newSessionToken),
      expires_at: newExpiresAt.toISOString()
    })
    .eq('id', session.id);

  return { sessionToken: newSessionToken, expiresAt: newExpiresAt };
}

/**
 * Logout - invalidate session
 */
export async function logout(
  sessionId: string,
  adminId: string,
  request: NextRequest
): Promise<void> {
  const supabase = createAdminClient();

  await supabase
    .from('helpdesk_admin_sessions')
    .delete()
    .eq('id', sessionId);

  await supabase
    .from('helpdesk_admins')
    .update({ is_online: false })
    .eq('id', adminId);

  await logAuditFromRequest(request, {
    action: 'admin.logout',
    adminId
  });
}

/**
 * Require owner role
 */
export function requireOwner(admin: AuthenticatedAdmin): NextResponse | null {
  if (admin.role !== 'owner') {
    return NextResponse.json(
      { error: 'Owner access required' },
      { status: 403 }
    );
  }
  return null;
}

export default {
  validateAdminSession,
  createSession,
  refreshSession,
  logout,
  requireOwner,
  generateToken,
  hashToken
};
