import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET single lock by ID
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const lock = await prisma.lock.findUnique({
      where: {
        id: params.id,
      },
    });

    if (!lock) {
      return NextResponse.json(
        { error: 'Lock not found' },
        { status: 404 }
      );
    }

    // Convert BigInt to string for JSON serialization
    const lockResponse = {
      ...lock,
      lockId: lock.lockId.toString(),
    };

    return NextResponse.json(lockResponse);
  } catch (error) {
    console.error('Error fetching lock:', error);
    return NextResponse.json(
      { error: 'Failed to fetch lock' },
      { status: 500 }
    );
  }
}

// PATCH update lock
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const { isUnlocked, isActive } = body;

    const updateData: any = {};

    if (typeof isUnlocked === 'boolean') {
      updateData.isUnlocked = isUnlocked;
    }

    if (typeof isActive === 'boolean') {
      updateData.isActive = isActive;
    }

    const lock = await prisma.lock.update({
      where: {
        id: params.id,
      },
      data: updateData,
    });

    // Convert BigInt to string for JSON serialization
    const lockResponse = {
      ...lock,
      lockId: lock.lockId.toString(),
    };

    return NextResponse.json(lockResponse);
  } catch (error) {
    console.error('Error updating lock:', error);
    return NextResponse.json(
      { error: 'Failed to update lock' },
      { status: 500 }
    );
  }
}

// DELETE lock
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await prisma.lock.delete({
      where: {
        id: params.id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting lock:', error);
    return NextResponse.json(
      { error: 'Failed to delete lock' },
      { status: 500 }
    );
  }
}

