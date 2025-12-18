/**
 * StakePoint Helpdesk - Audit Logging
 * Tracks all admin actions for security review
 */

import { createAdminClient } from './supabase';

export type AuditAction =
  | 'admin.login'
  | 'admin.logout'
  | 'admin.login_failed'
  | 'admin.created'
  | 'admin.updated'
  | 'admin.deleted'
  | 'admin.password_changed'
  | 'message.sent'
  | 'conversation.status_changed'
  | 'conversation.assigned'
  | 'session.created'
  | 'session.expired'
  | 'security.rate_limited'
  | 'security.ip_blocked'
  | 'security.suspicious_activity';

export interface AuditLogEntry {
  action: AuditAction;
  adminId?: string;
  targetId?: string;
  targetType?: 'admin' | 'conversation' | 'message' | 'visitor';
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log an audit event
 */
export async function logAudit(entry: AuditLogEntry): Promise<void> {
  try {
    const supabase = createAdminClient();
    
    await supabase
      .from('helpdesk_audit_logs')
      .insert({
        action: entry.action,
        admin_id: entry.adminId || null,
        target_id: entry.targetId || null,
        target_type: entry.targetType || null,
        metadata: entry.metadata || {},
        ip_address: entry.ipAddress || null,
        user_agent: entry.userAgent || null,
        created_at: new Date().toISOString()
      });
  } catch (error) {
    // Don't let audit logging failures break the app
    console.error('Audit log error:', error);
  }
}

/**
 * Log from a request context
 */
export async function logAuditFromRequest(
  request: Request,
  entry: Omit<AuditLogEntry, 'ipAddress' | 'userAgent'>
): Promise<void> {
  const forwarded = request.headers.get('x-forwarded-for');
  const ipAddress = forwarded ? forwarded.split(',')[0].trim() :
                    request.headers.get('x-real-ip') || 
                    'unknown';
  
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  await logAudit({
    ...entry,
    ipAddress,
    userAgent
  });
}

/**
 * Get audit logs (for admin review)
 */
export async function getAuditLogs(options: {
  adminId?: string;
  action?: AuditAction;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}): Promise<any[]> {
  const supabase = createAdminClient();
  
  let query = supabase
    .from('helpdesk_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options.limit || 100);
  
  if (options.adminId) {
    query = query.eq('admin_id', options.adminId);
  }
  
  if (options.action) {
    query = query.eq('action', options.action);
  }
  
  if (options.startDate) {
    query = query.gte('created_at', options.startDate.toISOString());
  }
  
  if (options.endDate) {
    query = query.lte('created_at', options.endDate.toISOString());
  }
  
  const { data, error } = await query;
  
  if (error) {
    console.error('Get audit logs error:', error);
    return [];
  }
  
  return data || [];
}

/**
 * Detect suspicious activity patterns
 */
export async function checkSuspiciousActivity(
  ipAddress: string
): Promise<{ suspicious: boolean; reason?: string }> {
  const supabase = createAdminClient();
  
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  // Check failed logins from this IP
  const { count: failedLogins } = await supabase
    .from('helpdesk_audit_logs')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'admin.login_failed')
    .eq('ip_address', ipAddress)
    .gte('created_at', oneHourAgo);
  
  if (failedLogins && failedLogins >= 10) {
    return { 
      suspicious: true, 
      reason: `${failedLogins} failed login attempts in the last hour` 
    };
  }
  
  // Check for multiple admin accounts accessed from same IP
  const { data: uniqueAdmins } = await supabase
    .from('helpdesk_audit_logs')
    .select('admin_id')
    .eq('action', 'admin.login')
    .eq('ip_address', ipAddress)
    .gte('created_at', oneHourAgo);
  
  const uniqueAdminCount = new Set(uniqueAdmins?.map(a => a.admin_id)).size;
  
  if (uniqueAdminCount >= 3) {
    return {
      suspicious: true,
      reason: `${uniqueAdminCount} different admin accounts logged in from same IP`
    };
  }
  
  return { suspicious: false };
}

export default {
  logAudit,
  logAuditFromRequest,
  getAuditLogs,
  checkSuspiciousActivity
};
