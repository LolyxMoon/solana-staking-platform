/**
 * StakePoint Helpdesk - Secure Conversations API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/helpdesk/supabase';
import { validateAdminSession } from '@/lib/helpdesk/admin-auth';
import { rateLimit, RATE_LIMITS } from '@/lib/helpdesk/rate-limit';

export async function GET(request: NextRequest) {
  const { admin, error } = await validateAdminSession(request);
  if (error) return error;

  const rateLimited = rateLimit(request, RATE_LIMITS.api);
  if (rateLimited) return rateLimited;

  try {
    const supabase = createAdminClient();

    const { data: conversations, error: fetchError } = await supabase
      .from('helpdesk_conversations')
      .select(`
        *,
        visitor:helpdesk_visitors(*),
        assigned_admin:helpdesk_admins(id, display_name, avatar_url)
      `)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('Fetch conversations error:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 });
    }

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('Conversations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
