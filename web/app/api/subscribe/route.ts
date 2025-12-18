/**
 * StakePoint Helpdesk - Push Subscription Management
 * Admins subscribe to push notifications here
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

// POST - Subscribe to push notifications
export async function POST(request: NextRequest) {
  try {
    const { subscription, adminId } = await request.json();

    if (!subscription || !adminId) {
      return NextResponse.json(
        { error: 'subscription and adminId required' },
        { status: 400 }
      );
    }

    const subscriptionString = JSON.stringify(subscription);

    // Upsert subscription (update if exists, insert if new)
    const { error } = await supabase
      .from('helpdesk_push_subscriptions')
      .upsert(
        {
          admin_id: adminId,
          subscription: subscriptionString,
          endpoint: subscription.endpoint,
          updated_at: new Date().toISOString()
        },
        {
          onConflict: 'admin_id'
        }
      );

    if (error) {
      console.error('Save subscription error:', error);
      return NextResponse.json(
        { error: 'Failed to save subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Subscription error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Unsubscribe from push notifications
export async function DELETE(request: NextRequest) {
  try {
    const { adminId } = await request.json();

    if (!adminId) {
      return NextResponse.json(
        { error: 'adminId required' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('helpdesk_push_subscriptions')
      .delete()
      .eq('admin_id', adminId);

    if (error) {
      console.error('Delete subscription error:', error);
      return NextResponse.json(
        { error: 'Failed to delete subscription' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
