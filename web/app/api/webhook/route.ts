/**
 * StakePoint Helpdesk - Push Notification Webhook
 * Supabase calls this when a new visitor message arrives
 */

import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';

// VAPID keys for web push (generate once, keep forever)
// Generate at: https://vapidkeys.com/ or use web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;

webpush.setVapidDetails(
  'mailto:contact@stakepoint.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Store subscriptions in Supabase (we'll create a table for this)
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    
    // Verify this is from Supabase (check secret header)
    const webhookSecret = request.headers.get('x-webhook-secret');
    if (webhookSecret !== process.env.SUPABASE_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only notify for visitor messages
    if (payload.type !== 'INSERT' || payload.table !== 'helpdesk_messages') {
      return NextResponse.json({ ok: true });
    }

    const message = payload.record;
    
    // Only notify for visitor messages, not admin replies
    if (message.sender_type !== 'visitor') {
      return NextResponse.json({ ok: true });
    }

    // Get all admin push subscriptions
    const { data: subscriptions } = await supabase
      .from('helpdesk_push_subscriptions')
      .select('subscription');

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ ok: true, message: 'No subscriptions' });
    }

    // Decrypt message content for notification preview
    // Note: For security, we'll just show "New message" without content
    const notificationPayload = JSON.stringify({
      title: '💬 New Support Message',
      body: 'A visitor sent a message',
      icon: '/favicon.jpg',
      badge: '/favicon.jpg',
      tag: 'helpdesk-message',
      data: {
        url: '/helpdesk/admin/dashboard',
        conversationId: message.conversation_id
      }
    });

    // Send to all subscribed admins
    const results = await Promise.allSettled(
      subscriptions.map(({ subscription }) =>
        webpush.sendNotification(
          JSON.parse(subscription),
          notificationPayload
        ).catch(async (error) => {
          // Remove invalid subscriptions
          if (error.statusCode === 410) {
            await supabase
              .from('helpdesk_push_subscriptions')
              .delete()
              .eq('subscription', subscription);
          }
          throw error;
        })
      )
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return NextResponse.json({ ok: true, sent, failed });
  } catch (error) {
    console.error('Push notification error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
