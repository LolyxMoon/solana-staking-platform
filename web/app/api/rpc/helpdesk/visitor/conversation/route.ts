/**
 * StakePoint Helpdesk - Visitor Conversation API
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { rateLimit, RATE_LIMITS } from '@/lib/helpdesk/rate-limit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const visitorUUID = request.headers.get('x-visitor-uuid');
  
  if (!visitorUUID) {
    return NextResponse.json({ error: 'Visitor UUID required' }, { status: 400 });
  }

  // Rate limit
  const rateLimited = rateLimit(request, RATE_LIMITS.api);
  if (rateLimited) return rateLimited;

  try {
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { 'x-visitor-uuid': visitorUUID } }
    });

    // Get visitor's most recent open conversation
    const { data: visitor } = await supabase
      .from('helpdesk_visitors')
      .select('id')
      .eq('visitor_uuid', visitorUUID)
      .single();

    if (!visitor) {
      return NextResponse.json({ conversation: null });
    }

    const { data: conversation } = await supabase
      .from('helpdesk_conversations')
      .select('id, status, subject, created_at')
      .eq('visitor_id', visitor.id)
      .in('status', ['open', 'pending'])
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    return NextResponse.json({ conversation: conversation || null });
  } catch (error) {
    console.error('Get conversation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
