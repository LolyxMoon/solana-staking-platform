import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const visitorUUID = request.headers.get('x-visitor-uuid');
  
  if (!visitorUUID) {
    return NextResponse.json({ error: 'Visitor UUID required' }, { status: 400 });
  }

  try {
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
