import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";

// Max file size: 250MB
const MAX_FILE_SIZE = 250 * 1024 * 1024;

// Allowed types for different contexts
const BUG_REPORT_TYPES = ["video/mp4"];
const TASK_ATTACHMENT_TYPES = [
  "video/mp4",
  "image/jpeg",
  "image/png",
];
const AD_LIBRARY_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];
const AD_GENERATOR_TYPES = [
  "image/png",
];
const PRESENTATION_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
];
const WORKFLOW_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
];
const KNOWLEDGE_BASE_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
];

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const context = formData.get("context") as string | null; // "bug-report" or "task"

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Determine allowed types based on context
    let allowedTypes: string[];
    let folder: string;
    
    if (context === "task") {
      allowedTypes = TASK_ATTACHMENT_TYPES;
      folder = "task-attachments";
    } else if (context === "ad-library") {
      allowedTypes = AD_LIBRARY_TYPES;
      folder = "ad-library";
    } else if (context === "ad-generator") {
      allowedTypes = AD_GENERATOR_TYPES;
      folder = "ad-generator";
    } else if (context === "presentations") {
      allowedTypes = PRESENTATION_TYPES;
      folder = "presentations";
    } else if (context === "knowledge-base") {
      allowedTypes = KNOWLEDGE_BASE_TYPES;
      folder = "knowledge-base";
    } else if (context === "workflow") {
      allowedTypes = WORKFLOW_TYPES;
      folder = "workflow-attachments";
    } else {
      allowedTypes = BUG_REPORT_TYPES;
      folder = "bug-reports";
    }

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      let typeMessage: string;
      if (context === "task") {
        typeMessage = "Invalid file type. Only PNG, JPG, and MP4 files are allowed.";
      } else if (context === "ad-library") {
        typeMessage = "Invalid file type. Only PNG, JPG, GIF, and WebP images are allowed.";
      } else if (context === "presentations") {
        typeMessage = "Invalid file type. Only images (PNG, JPG, GIF, WebP) and videos (MP4, WebM) are allowed.";
      } else if (context === "knowledge-base") {
        typeMessage = "Invalid file type. Only PDF, TXT, and MD files are allowed.";
      } else if (context === "workflow") {
        typeMessage = "Invalid file type. Only images (PNG, JPG, GIF, WebP) and videos (MP4, WebM) are allowed.";
      } else {
        typeMessage = "Invalid file type. Only MP4 videos are allowed.";
      }
      return NextResponse.json(
        { error: typeMessage },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 250MB." },
        { status: 400 }
      );
    }

    // Generate a unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${folder}/${timestamp}-${sanitizedName}`;

    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: "public",
      addRandomSuffix: true,
    });

    return NextResponse.json({
      url: blob.url,
      name: file.name,
      size: file.size,
      type: file.type,
    });
  } catch (error) {
    console.error("Error uploading file:", error);
    return NextResponse.json(
      { error: "Failed to upload file" },
      { status: 500 }
    );
  }
}
