import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const visitorUUID = request.headers.get('x-visitor-uuid');
  
  if (!visitorUUID) {
    return NextResponse.json({ error: 'Visitor UUID required' }, { status: 400 });
  }

  try {
    const { pageUrl, userAgent } = await request.json();

    const forwarded = request.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip).digest('hex');

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
        { onConflict: 'visitor_uuid' }
      )
      .select('id')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, visitorId: visitor.id });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
