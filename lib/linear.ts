import "server-only";
import { LinearClient } from "@linear/sdk";

export interface LinearIssue {
  id: string;
  title: string;
  description: string;
  state: {
    name: string;
    color: string;
  };
  priority: number;
  assignee?: {
    name: string;
    avatarUrl?: string;
  };
  labels: Array<{
    name: string;
    color: string;
  }>;
  createdAt: string;
  updatedAt: string;
  dueDate?: string;
  estimate?: number;
  team: {
    name: string;
  };
}

export interface LinearView {
  id: string;
  name: string;
  issues: {
    nodes: LinearIssue[];
  };
}

export async function getIssuesFromView(viewId: string): Promise<LinearIssue[]> {
  try {
    const client = new LinearClient({ apiKey: process.env.LINEAR_API_KEY });
    
    // Try to get issues from the view
    const view = await client.customView(viewId);
    if (!view) {
      throw new Error(`View with ID ${viewId} not found`);
    }

    console.log(`Fetching issues from view: ${view.name}`);

    // Get issues from the view
    const issues = await view.issues({
      first: 25,
    });
    
    // Transform the issues to match our interface
    const transformedIssues: LinearIssue[] = await Promise.all(
      issues.nodes.map(async (issue) => {
        const state = await issue.state;
        const team = await issue.team;
        const assignee = issue.assignee ? await issue.assignee : undefined;
        const labels = await issue.labels();

        return {
          id: issue.id,
          title: issue.title,
          description: issue.description || "",
          state: {
            name: state?.name || "",
            color: state?.color || "",
          },
          priority: issue.priority,
          assignee: assignee ? {
            name: assignee.name,
            avatarUrl: assignee.avatarUrl || undefined,
          } : undefined,
          labels: labels.nodes.map(label => ({
            name: label.name,
            color: label.color,
          })),
          createdAt: issue.createdAt.toISOString(),
          updatedAt: issue.updatedAt.toISOString(),
          dueDate: issue.dueDate?.toISOString(),
          estimate: issue.estimate || undefined,
          team: {
            name: team?.name || "",
          },
        };
      })
    );

    return transformedIssues;

  } catch (error) {
    console.error("Error fetching Linear issues from view:", error);
    throw new Error(`Failed to fetch issues from view: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
