import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/adminMiddleware';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// PUT update pop-up ad
export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const authResult = await verifyAdminToken(req);
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    
    const data = await prisma.popUpAd.update({
      where: { id: params.id },
      data: {
        title: body.title,
        description: body.description || null,
        imageUrl: body.image_url || null,
        ctaText: body.cta_text || null,
        ctaLink: body.cta_link || null,
        contractAddress: body.contract_address || null,
        isActive: body.is_active,
        startDate: body.start_date ? new Date(body.start_date) : null,
        endDate: body.end_date ? new Date(body.end_date) : null,
        displayFrequency: body.display_frequency,
      }
    });

    console.log(`[ADMIN] Pop-up ad ${params.id} updated by wallet: ${authResult.wallet}`);

    const response = {
      id: data.id,
      title: data.title,
      description: data.description,
      image_url: data.imageUrl,
      cta_text: data.ctaText,
      cta_link: data.ctaLink,
      contract_address: data.contractAddress,
      is_active: data.isActive,
      start_date: data.startDate?.toISOString(),
      end_date: data.endDate?.toISOString(),
      display_frequency: data.displayFrequency,
      created_at: data.createdAt.toISOString(),
    };

    return NextResponse.json({ success: true, data: response });
  } catch (error) {
    console.error('Error updating pop-up ad:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update pop-up ad' },
      { status: 500 }
    );
  }
}

// DELETE pop-up ad
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const authResult = await verifyAdminToken(req);
  if (!authResult.isValid) {
    return NextResponse.json(
      { error: authResult.error || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    await prisma.popUpAd.delete({
      where: { id: params.id }
    });

    console.log(`[ADMIN] Pop-up ad ${params.id} deleted by wallet: ${authResult.wallet}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting pop-up ad:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete pop-up ad' },
      { status: 500 }
    );
  }
}