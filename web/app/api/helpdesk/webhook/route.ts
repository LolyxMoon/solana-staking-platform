import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// Configure web-push
webpush.setVapidDetails(
  'mailto:contact@stakepoint.app',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    // Verify webhook secret
    const secret = request.headers.get('x-webhook-secret');
    if (secret !== process.env.SUPABASE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    
    // Only handle new visitor messages
    if (payload.type !== 'INSERT' || payload.record?.sender_type !== 'visitor') {
      return NextResponse.json({ success: true, skipped: true });
    }

    const supabase = getSupabase();

    // Get all admin push subscriptions
    const { data: subscriptions } = await supabase
      .from('helpdesk_push_subscriptions')
      .select('subscription, admin_id');

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, noSubscribers: true });
    }

    // Send push to all admins
    const notifications = subscriptions.map(async (sub) => {
      try {
        const pushSubscription = JSON.parse(sub.subscription);
        await webpush.sendNotification(
          pushSubscription,
          JSON.stringify({
            title: 'New Support Message',
            body: 'You have a new message from a visitor',
            icon: '/favicon.jpg',
            url: '/helpdesk/admin/dashboard'
          })
        );
      } catch (err: any) {
        // Remove invalid subscriptions
        if (err.statusCode === 410) {
          await supabase
            .from('helpdesk_push_subscriptions')
            .delete()
            .eq('admin_id', sub.admin_id);
        }
        console.error('Push failed:', err);
      }
    });

    await Promise.all(notifications);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}