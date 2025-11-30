import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/adminMiddleware';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// GET all pop-up ads (admin)
export async function GET(req: Request) {
  const authResult = await verifyAdminToken(req);
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const data = await prisma.popUpAd.findMany({
      orderBy: {
        createdAt: 'desc'
      }
    });

    const response = data.map(ad => ({
      id: ad.id,
      title: ad.title,
      description: ad.description,
      image_url: ad.imageUrl,
      cta_text: ad.ctaText,
      cta_link: ad.ctaLink,
      is_active: ad.isActive,
      start_date: ad.startDate?.toISOString(),
      end_date: ad.endDate?.toISOString(),
      display_frequency: ad.displayFrequency,
      created_at: ad.createdAt.toISOString(),
    }));

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('Error fetching pop-up ads:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch pop-up ads' },
      { status: 500 }
    );
  }
}

// POST create new pop-up ad
export async function POST(req: Request) {
  const authResult = await verifyAdminToken(req);
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    
    const data = await prisma.popUpAd.create({
      data: {
        title: body.title,
        description: body.description || null,
        imageUrl: body.image_url || null,
        ctaText: body.cta_text || null,
        ctaLink: body.cta_link || null,
        isActive: body.is_active ?? true,
        startDate: body.start_date ? new Date(body.start_date) : null,
        endDate: body.end_date ? new Date(body.end_date) : null,
        displayFrequency: body.display_frequency ?? 'once_per_session',
      }
    });

    console.log(`[ADMIN] Pop-up ad created by wallet: ${authResult.wallet}`);

    const response = {
      id: data.id,
      title: data.title,
      description: data.description,
      image_url: data.imageUrl,
      cta_text: data.ctaText,
      cta_link: data.ctaLink,
      is_active: data.isActive,
      start_date: data.startDate?.toISOString(),
      end_date: data.endDate?.toISOString(),
      display_frequency: data.displayFrequency,
      created_at: data.createdAt.toISOString(),
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('Error creating pop-up ad:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create pop-up ad' },
      { status: 500 }
    );
  }
}