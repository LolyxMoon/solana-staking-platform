import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { TelegramBotService } from '@/lib/telegram-bot';

const botService = new TelegramBotService(prisma);

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();
    
    // Process the update
    await botService.processUpdate(update);
    
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// Verify it's Telegram calling us
export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'Webhook is active' });
}
