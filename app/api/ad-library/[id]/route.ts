import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { del } from "@vercel/blob";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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

    const { id } = await params;

    // Get the item first to get the image URL
    const item = await prisma.adLibraryItem.findUnique({
      where: { id },
    });

    if (!item) {
      return NextResponse.json(
        { data: null, error: "Item not found" },
        { status: 404 }
      );
    }

    // Delete from database
    await prisma.adLibraryItem.delete({
      where: { id },
    });

    // Try to delete from Vercel Blob (don't fail if this doesn't work)
    try {
      await del(item.imageUrl);
    } catch (blobError) {
      console.error("Failed to delete blob:", blobError);
      // Continue anyway - the database record is deleted
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error("Error deleting ad library item:", error);
    return NextResponse.json(
      { data: null, error: "Failed to delete ad library item" },
      { status: 500 }
    );
  }
}
