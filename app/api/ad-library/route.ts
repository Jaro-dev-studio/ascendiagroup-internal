import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json(
        { data: null, error: "Not authorized" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { imageUrl, title, sourceUrl, description, tags } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { data: null, error: "Image URL is required" },
        { status: 400 }
      );
    }

    const item = await prisma.adLibraryItem.create({
      data: {
        imageUrl,
        title: title || null,
        sourceUrl: sourceUrl || null,
        description: description || null,
        tags: tags || [],
      },
    });

    return NextResponse.json({ data: item, error: null });
  } catch (error) {
    console.error("Error creating ad library item:", error);
    return NextResponse.json(
      { data: null, error: "Failed to create ad library item" },
      { status: 500 }
    );
  }
}

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Not authenticated" },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return NextResponse.json(
        { data: null, error: "Not authorized" },
        { status: 403 }
      );
    }

    const items = await prisma.adLibraryItem.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: items, error: null });
  } catch (error) {
    console.error("Error fetching ad library items:", error);
    return NextResponse.json(
      { data: null, error: "Failed to fetch ad library items" },
      { status: 500 }
    );
  }
}
