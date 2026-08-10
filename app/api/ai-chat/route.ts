import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";
import { serializeChatMessages } from "@/lib/ai-agent/serialize";

// GET - List all chats for the current user
export async function GET() {
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

    // Fetch all chats with just the last message for preview
    const chats = await prisma.aIChat.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      include: {
        messages: {
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    // For the first 5 chats, fetch all messages
    const chatIds = chats.slice(0, 5).map((c) => c.id);
    const preloadedChats = await prisma.aIChat.findMany({
      where: { id: { in: chatIds } },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
          include: { pendingActions: { orderBy: { createdAt: "asc" } } },
        },
      },
    });

    // Create a map of preloaded messages
    const preloadedMessagesMap = new Map(
      preloadedChats.map((chat) => [chat.id, serializeChatMessages(chat.messages)])
    );

    return NextResponse.json({
      data: chats.map((chat) => ({
        id: chat.id,
        title: chat.title,
        lastMessage: chat.messages[0]?.content.slice(0, 100) || null,
        updatedAt: chat.updatedAt.toISOString(),
        createdAt: chat.createdAt.toISOString(),
        // Include preloaded messages for first 5 chats
        messages: preloadedMessagesMap.get(chat.id) || null,
      })),
      error: null,
    });
  } catch (error) {
    console.error("[API] ai-chat GET error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}

// POST - Create a new chat
export async function POST() {
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

    const chat = await prisma.aIChat.create({
      data: {
        userId: user.id,
        title: "New Chat",
      },
    });

    return NextResponse.json({
      data: {
        id: chat.id,
        title: chat.title,
        createdAt: chat.createdAt.toISOString(),
      },
      error: null,
    });
  } catch (error) {
    console.error("[API] ai-chat POST error:", error);
    return NextResponse.json(
      { data: null, error: "Failed to create chat" },
      { status: 500 }
    );
  }
}
