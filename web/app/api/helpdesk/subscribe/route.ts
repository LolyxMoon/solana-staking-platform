import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { subscription, adminId } = await request.json();

    if (!subscription || !adminId) {
      return NextResponse.json({ error: 'Missing subscription or adminId' }, { status: 400 });
    }

    // Delete existing subscriptions for this admin first
    await supabase
      .from('helpdesk_push_subscriptions')
      .delete()
      .eq('admin_id', adminId);

    // Insert new subscription
    const { error } = await supabase
      .from('helpdesk_push_subscriptions')
      .insert({
        admin_id: adminId,
        endpoint: subscription.endpoint,
        subscription: JSON.stringify(subscription),
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('Save subscription error:', error);
      return NextResponse.json({ error: 'Failed to save subscription' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = getSupabase();
    const { adminId } = await request.json();

    if (!adminId) {
      return NextResponse.json({ error: 'Missing adminId' }, { status: 400 });
    }

    await supabase
      .from('helpdesk_push_subscriptions')
      .delete()
      .eq('admin_id', adminId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}