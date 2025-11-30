import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// GET - Fetch SEO data for a specific page
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page");

    if (page) {
      const seo = await prisma.sEO.findUnique({
        where: { page },
      });

      if (!seo) {
        return NextResponse.json(
          { error: "SEO data not found for this page" },
          { status: 404 }
        );
      }

      return NextResponse.json(seo);
    }

    // If no page specified, return all SEO data
    const allSeo = await prisma.sEO.findMany({
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(allSeo);
  } catch (error: any) {
    console.error("GET SEO Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch SEO data" },
      { status: 500 }
    );
  }
}

// POST - Create new SEO entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      page,
      title,
      description,
      keywords,
      ogTitle,
      ogDescription,
      ogImage,
      twitterCard,
      twitterTitle,
      twitterDescription,
      twitterImage,
      canonicalUrl,
    } = body;

    if (!page || !title || !description) {
      return NextResponse.json(
        { error: "Page, title, and description are required" },
        { status: 400 }
      );
    }

    const seo = await prisma.sEO.create({
      data: {
        page,
        title,
        description,
        keywords,
        ogTitle,
        ogDescription,
        ogImage,
        twitterCard: twitterCard || "summary_large_image",
        twitterTitle,
        twitterDescription,
        twitterImage,
        canonicalUrl,
      },
    });

    return NextResponse.json(seo, { status: 201 });
  } catch (error: any) {
    console.error("POST SEO Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create SEO data" },
      { status: 500 }
    );
  }
}

// PATCH - Update existing SEO entry
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { page, ...updateData } = body;

    if (!page) {
      return NextResponse.json(
        { error: "Page identifier is required" },
        { status: 400 }
      );
    }

    const seo = await prisma.sEO.update({
      where: { page },
      data: updateData,
    });

    return NextResponse.json(seo);
  } catch (error: any) {
    console.error("PATCH SEO Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update SEO data" },
      { status: 500 }
    );
  }
}

// DELETE - Delete SEO entry
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page");

    if (!page) {
      return NextResponse.json(
        { error: "Page identifier is required" },
        { status: 400 }
      );
    }

    await prisma.sEO.delete({
      where: { page },
    });

    return NextResponse.json({ message: "SEO data deleted successfully" });
  } catch (error: any) {
    console.error("DELETE SEO Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete SEO data" },
      { status: 500 }
    );
  }
}