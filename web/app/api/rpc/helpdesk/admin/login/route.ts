/**
 * StakePoint Helpdesk - Secure Admin Login
 * With rate limiting, audit logging, and account lockout
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/helpdesk/supabase';
import { createSession } from '@/lib/helpdesk/admin-auth';
import { rateLimit, RATE_LIMITS, resetRateLimit, blockIP } from '@/lib/helpdesk/rate-limit';
import { logAuditFromRequest, checkSuspiciousActivity } from '@/lib/helpdesk/audit';

export async function POST(request: NextRequest) {
  // Rate limit login attempts
  const rateLimited = rateLimit(request, RATE_LIMITS.login);
  if (rateLimited) {
    await logAuditFromRequest(request, {
      action: 'security.rate_limited',
      metadata: { endpoint: 'login' }
    });
    return rateLimited;
  }

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check for suspicious activity from this IP
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded ? forwarded.split(',')[0].trim() :
                      request.headers.get('x-real-ip') || 'unknown';

    const suspicious = await checkSuspiciousActivity(ipAddress);
    if (suspicious.suspicious) {
      await logAuditFromRequest(request, {
        action: 'security.suspicious_activity',
        metadata: { reason: suspicious.reason }
      });
      
      // Block IP for 1 hour
      blockIP(request, 60 * 60 * 1000);
      
      return NextResponse.json(
        { error: 'Access temporarily blocked due to suspicious activity' },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();

    // Authenticate (includes lockout check)
    const { data, error } = await supabase
      .rpc('authenticate_admin', {
        p_email: email,
        p_password: password
      });

    if (error) {
      console.error('Login error:', error);
      
      await logAuditFromRequest(request, {
        action: 'admin.login_failed',
        metadata: { email, reason: 'database_error' }
      });

      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    if (!data || data.length === 0) {
      await logAuditFromRequest(request, {
        action: 'admin.login_failed',
        metadata: { email, reason: 'invalid_credentials' }
      });

      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const adminData = data[0];

    // Check if 2FA is enabled
    if (adminData.totp_enabled) {
      // Return partial response - client needs to provide TOTP code
      return NextResponse.json({
        requiresTOTP: true,
        adminId: adminData.admin_id
      });
    }

    // Create session
    const { sessionToken, refreshToken, expiresAt } = await createSession(
      adminData.admin_id,
      request
    );

    // Reset rate limit on successful login
    resetRateLimit(request, 'login');

    await logAuditFromRequest(request, {
      action: 'admin.login',
      adminId: adminData.admin_id
    });

    return NextResponse.json({
      adminId: adminData.admin_id,
      displayName: adminData.display_name,
      avatarUrl: adminData.avatar_url,
      role: adminData.role,
      sessionToken,
      refreshToken,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
