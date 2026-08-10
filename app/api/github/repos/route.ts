import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/authOptions";
import prisma from "@/lib/prisma";

const GITHUB_ORG = process.env.GITHUB_ORG || "Jaro-dev-studio";

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  private: boolean;
  updated_at: string;
  pushed_at: string;
  default_branch: string;
}

/**
 * GET /api/github/repos
 * Fetch all repositories from the GitHub organization
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json(
        { data: null, error: "Not authenticated" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user || (user.role !== "ADMIN" && user.role !== "DEVELOPER")) {
      return NextResponse.json(
        { data: null, error: "Not authorized" },
        { status: 403 }
      );
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      return NextResponse.json(
        { data: null, error: "GITHUB_TOKEN not configured" },
        { status: 500 }
      );
    }

    // Fetch all repos from the org (paginated)
    const allRepos: GitHubRepo[] = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      const response = await fetch(
        `https://api.github.com/orgs/${GITHUB_ORG}/repos?per_page=${perPage}&page=${page}&sort=pushed&direction=desc`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.text();
        console.error("[GitHub Repos API] Error fetching repos:", errorData);
        return NextResponse.json(
          { data: null, error: `GitHub API error: ${response.status}` },
          { status: 500 }
        );
      }

      const repos: GitHubRepo[] = await response.json();
      allRepos.push(...repos);

      // If we got fewer repos than requested, we've reached the end
      if (repos.length < perPage) {
        break;
      }

      page++;

      // Safety limit to prevent infinite loops
      if (page > 10) {
        break;
      }
    }

    // Transform to simpler format for the frontend
    const repoList = allRepos.map((repo) => ({
      name: repo.name,
      fullName: repo.full_name,
      url: repo.html_url,
      description: repo.description,
      isPrivate: repo.private,
      updatedAt: repo.updated_at,
      pushedAt: repo.pushed_at,
      defaultBranch: repo.default_branch,
    }));

    return NextResponse.json({
      data: repoList,
      error: null,
    });
  } catch (error) {
    console.error("[GitHub Repos API] Error:", error);
    return NextResponse.json(
      {
        data: null,
        error: error instanceof Error ? error.message : "Failed to fetch repos",
      },
      { status: 500 }
    );
  }
}
