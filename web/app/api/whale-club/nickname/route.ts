import { NextRequest, NextResponse } from 'next/server';

function getSupabase() {
  const { createClient } = require('@supabase/supabase-js');
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  
  if (!wallet) {
    return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('whale_club_users')
      .select('nickname')
      .eq('wallet_address', wallet)
      .single();
    
    if (error) throw error;
    return NextResponse.json({ nickname: data?.nickname || null });
  } catch (error) {
    console.error('Error fetching nickname:', error);
    return NextResponse.json({ error: 'Failed to fetch nickname' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { wallet, nickname } = await request.json();
    
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
    }

    const cleanNickname = nickname?.trim().slice(0, 20) || null;
    
    if (cleanNickname && !/^[a-zA-Z0-9_\-\s]+$/.test(cleanNickname)) {
      return NextResponse.json({ error: 'Invalid characters in nickname' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Check uniqueness
    if (cleanNickname) {
      const { data: existing } = await supabase
        .from('whale_club_users')
        .select('wallet_address')
        .ilike('nickname', cleanNickname)
        .neq('wallet_address', wallet)
        .maybeSingle();
      
      if (existing) {
        return NextResponse.json({ error: 'Nickname already taken' }, { status: 400 });
      }
    }

    // First check if user exists
    const { data: existingUser } = await supabase
      .from('whale_club_users')
      .select('wallet_address')
      .eq('wallet_address', wallet)
      .maybeSingle();

    if (existingUser) {
      // Update existing user
      const { data, error } = await supabase
        .from('whale_club_users')
        .update({ nickname: cleanNickname, updated_at: new Date().toISOString() })
        .eq('wallet_address', wallet)
        .select('nickname')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, nickname: data.nickname });
    } else {
      // Create new user
      const { data, error } = await supabase
        .from('whale_club_users')
        .insert({ wallet_address: wallet, nickname: cleanNickname })
        .select('nickname')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, nickname: data.nickname });
    }
  } catch (error) {
    console.error('Error setting nickname:', error);
    return NextResponse.json({ error: 'Failed to set nickname' }, { status: 500 });
  }
}