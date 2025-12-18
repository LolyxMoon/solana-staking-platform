/**
 * StakePoint Helpdesk - Visitor Registration API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, RATE_LIMITS } from '@/lib/helpdesk/rate-limit';
import { hashData } from '@/lib/helpdesk/encryption.server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function POST(request: NextRequest) {
  const visitorUUID = request.headers.get('x-visitor-uuid');
  
  if (!visitorUUID) {
    return NextResponse.json({ error: 'Visitor UUID required' }, { status: 400 });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(visitorUUID)) {
    return NextResponse.json({ error: 'Invalid visitor UUID format' }, { status: 400 });
  }

  // Rate limit
  const rateLimited = rateLimit(request, RATE_LIMITS.api);
  if (rateLimited) return rateLimited;

  try {
    const { pageUrl, userAgent } = await request.json();

    // Hash IP for abuse prevention (not for tracking)
    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 
               request.headers.get('x-real-ip') || 
               'unknown';
    const ipHash = hashData(ip);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Upsert visitor
    const { data: visitor, error } = await supabase
      .from('helpdesk_visitors')
      .upsert(
        {
          visitor_uuid: visitorUUID,
          page_url: pageUrl?.slice(0, 500),
          user_agent: userAgent?.slice(0, 500),
          ip_hash: ipHash,
          last_seen_at: new Date().toISOString()
        },
        {
          onConflict: 'visitor_uuid',
          ignoreDuplicates: false
        }
      )
      .select('id')
      .single();

    if (error) {
      console.error('Visitor registration error:', error);
      return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, visitorId: visitor.id });
  } catch (error) {
    console.error('Visitor registration error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
