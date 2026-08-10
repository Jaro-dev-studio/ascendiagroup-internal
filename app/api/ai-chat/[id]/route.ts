import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { serializeChatMessages } from "@/lib/ai-agent/serialize";

// GET - Get chat with messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || user.role === "CLIENT") {
      return NextResponse.json(
        { data: null, error: "Access denied" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const chat = await prisma.aIChat.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { pendingActions: { orderBy: { createdAt: "asc" } } },
        },
      },
    });

    if (!chat) {
      return NextResponse.json(
        { data: null, error: "Chat not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: {
        id: chat.id,
        title: chat.title,
        messages: serializeChatMessages(chat.messages),
        createdAt: chat.createdAt.toISOString(),
        updatedAt: chat.updatedAt.toISOString(),
      },
      error: null,
    });
  } catch (error) {
    console.error("[API] ai-chat/[id] GET error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to fetch chat" },
      { status: 500 }
    );
  }
}

// PATCH - Update chat title
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || user.role === "CLIENT") {
      return NextResponse.json(
        { data: null, error: "Access denied" },
        { status: 403 }
      );
    }

    const { id } = await params;
    const body = await request.json();
    const { title } = body;

    if (!title || typeof title !== "string") {
      return NextResponse.json(
        { data: null, error: "Title is required" },
        { status: 400 }
      );
    }

    const chat = await prisma.aIChat.updateMany({
      where: {
        id,
        userId: user.id,
      },
      data: { title },
    });

    if (chat.count === 0) {
      return NextResponse.json(
        { data: null, error: "Chat not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: { success: true },
      error: null,
    });
  } catch (error) {
    console.error("[API] ai-chat/[id] PATCH error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to update chat" },
      { status: 500 }
    );
  }
}

// DELETE - Delete a chat
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || user.role === "CLIENT") {
      return NextResponse.json(
        { data: null, error: "Access denied" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const chat = await prisma.aIChat.deleteMany({
      where: {
        id,
        userId: user.id,
      },
    });

    if (chat.count === 0) {
      return NextResponse.json(
        { data: null, error: "Chat not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      data: { success: true },
      error: null,
    });
  } catch (error) {
    console.error("[API] ai-chat/[id] DELETE error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to delete chat" },
      { status: 500 }
    );
  }
}
