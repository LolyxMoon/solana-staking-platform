import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

async function verifySession(wallet: string, sessionToken: string): Promise<boolean> {
  const supabase = getSupabase();
  const { data } = await supabase
    .from('whale_club_users')
    .select('chat_session_token, chat_session_expiry')
    .eq('wallet_address', wallet)
    .maybeSingle();

  if (!data || !data.chat_session_token) return false;
  if (data.chat_session_token !== sessionToken) return false;
  if (new Date(data.chat_session_expiry) < new Date()) return false;
  
  return true;
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  const sessionToken = request.nextUrl.searchParams.get('session');
  const limit = parseInt(request.nextUrl.searchParams.get('limit') || '50');

  if (!wallet || !sessionToken) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!(await verifySession(wallet, sessionToken))) {
    return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('whale_club_messages')
      .select('id, wallet_address, nickname, message, created_at, reply_to_id, reply_to_preview')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return NextResponse.json({ messages: (data || []).reverse() });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { wallet, nickname, message, sessionToken, replyToId } = await request.json();

    if (!wallet || !message?.trim() || !sessionToken) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!(await verifySession(wallet, sessionToken))) {
      return NextResponse.json({ error: 'Invalid or expired session' }, { status: 401 });
    }

    const cleanMessage = message.trim().slice(0, 500);
    const supabase = getSupabase();

    // Get reply preview if replying
    let replyPreview = null;
    if (replyToId) {
      const { data: replyMsg } = await supabase
        .from('whale_club_messages')
        .select('nickname, message')
        .eq('id', replyToId)
        .single();
      
      if (replyMsg) {
        replyPreview = `${replyMsg.nickname || 'Anon'}: ${replyMsg.message.slice(0, 50)}${replyMsg.message.length > 50 ? '...' : ''}`;
      }
    }

    const { data, error } = await supabase
      .from('whale_club_messages')
      .insert({
        wallet_address: wallet,
        nickname: nickname,
        message: cleanMessage,
        reply_to_id: replyToId || null,
        reply_to_preview: replyPreview,
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-cleanup: Keep only last 500 messages
    const { data: oldMessages } = await supabase
      .from('whale_club_messages')
      .select('id')
      .order('created_at', { ascending: false })
      .range(500, 1000);

    if (oldMessages && oldMessages.length > 0) {
      const idsToDelete = oldMessages.map((m: any) => m.id);
      await supabase
        .from('whale_club_messages')
        .delete()
        .in('id', idsToDelete);
    }

    return NextResponse.json({ success: true, message: data });
  } catch (error) {
    console.error('Error posting message:', error);
    return NextResponse.json({ error: 'Failed to post message' }, { status: 500 });
  }
}