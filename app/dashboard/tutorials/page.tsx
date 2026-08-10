import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import { redirect } from "next/navigation";
import prisma from "@/lib/prisma";
import { TutorialsClient, Tutorial } from "./client";

// Tutorial definitions - add new tutorials here
const tutorialDefinitions = [
  {
    id: "1",
    title: "Jaro.dev Studio Tutorial",
    description:
      "Learn how to navigate and use the Jaro.dev Studio platform effectively. This comprehensive guide covers all the essential features you need to manage your project.",
    wistiaId: "wl9rchxyrx",
    category: "Getting Started",
  },
];

interface WistiaOEmbedResponse {
  thumbnail_url: string;
  duration: number;
}

async function fetchWistiaMetadata(wistiaId: string): Promise<{ thumbnailUrl: string; duration: string } | null> {
  try {
    const response = await fetch(
      `https://fast.wistia.com/oembed?url=https://home.wistia.com/medias/${wistiaId}`,
      { next: { revalidate: 86400 } } // Cache for 24 hours
    );

    if (!response.ok) {
      return null;
    }

    const data: WistiaOEmbedResponse = await response.json();

    // Convert seconds to human readable duration
    const minutes = Math.floor(data.duration / 60);
    const seconds = Math.round(data.duration % 60);
    const duration = seconds > 0 ? `${minutes}:${seconds.toString().padStart(2, "0")}` : `${minutes} min`;

    return {
      thumbnailUrl: data.thumbnail_url,
      duration,
    };
  } catch {
    return null;
  }
}

export default async function TutorialsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    redirect("/");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      role: true,
    },
  });

  if (!user) {
    redirect("/");
  }

  // Only clients can access this page
  if (user.role !== "CLIENT") {
    redirect("/dashboard");
  }

  // Fetch metadata for all tutorials in parallel
  const tutorialsWithMetadata: Tutorial[] = await Promise.all(
    tutorialDefinitions.map(async (tutorial) => {
      const metadata = await fetchWistiaMetadata(tutorial.wistiaId);
      return {
        ...tutorial,
        thumbnailUrl: metadata?.thumbnailUrl || null,
        duration: metadata?.duration || "Video",
      };
    })
  );

  return <TutorialsClient tutorials={tutorialsWithMetadata} />;
}
