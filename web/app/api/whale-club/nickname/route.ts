import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET nickname
export async function GET(request: NextRequest) {
  const wallet = request.nextUrl.searchParams.get('wallet');
  
  if (!wallet) {
    return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
  }

  try {
    const user = await prisma.whaleClubUser.findUnique({
      where: { walletAddress: wallet },
      select: { nickname: true }
    });
    
    return NextResponse.json({ nickname: user?.nickname || null });
  } catch (error) {
    console.error('Error fetching nickname:', error);
    return NextResponse.json({ error: 'Failed to fetch nickname' }, { status: 500 });
  }
}

// SET nickname
export async function POST(request: NextRequest) {
  try {
    const { wallet, nickname } = await request.json();
    
    if (!wallet) {
      return NextResponse.json({ error: 'Wallet required' }, { status: 400 });
    }

    // Validate nickname
    const cleanNickname = nickname?.trim().slice(0, 20) || null;
    
    if (cleanNickname && !/^[a-zA-Z0-9_\-\s]+$/.test(cleanNickname)) {
      return NextResponse.json({ error: 'Invalid characters in nickname' }, { status: 400 });
    }

    // Check uniqueness
    if (cleanNickname) {
      const existing = await prisma.whaleClubUser.findFirst({
        where: { 
          nickname: { equals: cleanNickname, mode: 'insensitive' },
          NOT: { walletAddress: wallet }
        }
      });
      
      if (existing) {
        return NextResponse.json({ error: 'Nickname already taken' }, { status: 400 });
      }
    }

    const user = await prisma.whaleClubUser.update({
      where: { walletAddress: wallet },
      data: { nickname: cleanNickname }
    });

    return NextResponse.json({ success: true, nickname: user.nickname });
  } catch (error) {
    console.error('Error setting nickname:', error);
    return NextResponse.json({ error: 'Failed to set nickname' }, { status: 500 });
  }
}