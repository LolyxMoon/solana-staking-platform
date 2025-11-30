import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Add these to prevent static generation
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // Show all available Prisma models
    return NextResponse.json(Object.keys(prisma));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}