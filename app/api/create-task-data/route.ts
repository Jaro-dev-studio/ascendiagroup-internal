import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "DEVELOPER")) {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const [clientCompanies, users] = await Promise.all([
      prisma.company.findMany({
        where: {
          status: "PURCHASED",
        },
        select: {
          id: true,
          name: true,
        },
        orderBy: {
          name: "asc",
        },
      }),
      prisma.user.findMany({
        where: {
          role: {
            in: ["ADMIN", "DEVELOPER"],
          },
        },
        select: {
          id: true,
          email: true,
          firstName: true,
        },
        orderBy: {
          email: "asc",
        },
      }),
    ]);

    return NextResponse.json({
      clientCompanies,
      users,
    });
  } catch (error) {
    console.error("Error fetching create task data:", error);
    return NextResponse.json(
      { error: "Failed to fetch data" },
      { status: 500 }
    );
  }
}
