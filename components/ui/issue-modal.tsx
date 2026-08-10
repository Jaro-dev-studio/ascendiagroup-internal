"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tag, Clock, User, ExternalLink, X } from "lucide-react";
import { LinearIssue } from "@/lib/linear";

interface IssueModalProps {
  issue: LinearIssue | null;
  isOpen: boolean;
  onClose: () => void;
}

// Utility function to safely parse markdown-style links
const parseMarkdownLinks = (text: string) => {
  // Regex to match markdown links: [text](url)
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  
  const parts = [];
  let lastIndex = 0;
  let match;
  
  while ((match = linkRegex.exec(text)) !== null) {
    // Add text before the link
    if (match.index > lastIndex) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex, match.index)
      });
    }
    
    // Add the link
    parts.push({
      type: "link",
      text: match[1],
      url: match[2]
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after the last link
  if (lastIndex < text.length) {
    parts.push({
      type: "text",
      content: text.slice(lastIndex)
    });
  }
  
  return parts;
};

export function IssueModal({ issue, isOpen, onClose }: IssueModalProps) {
  if (!issue) return null;

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 0: return "text-text-secondary";
      case 1: return "text-warning-dark";
      case 2: return "text-danger-dark";
      default: return "text-text-secondary";
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 0: return "No priority";
      case 1: return "Urgent";
      case 2: return "High";
      case 3: return "Medium";
      case 4: return "Low";
      default: return "Unknown";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <DialogTitle className="text-text-dark pr-8 text-2xl font-bold leading-tight">
                {issue.title}
              </DialogTitle>
              <div className="mt-2 flex items-center gap-4 text-sm text-text-secondary">
                <div className="flex items-center gap-1">
                  <Tag className="size-4" />
                  <span>{issue.team.name}</span>
                </div>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Priority Row */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-text-secondary">Status:</span>
              <Badge 
                className="px-3 py-1.5 text-sm font-medium"
                style={{ 
                  backgroundColor: issue.state.color + "20",
                  color: issue.state.color,
                  borderColor: issue.state.color + "40"
                }}
              >
                {issue.state.name}
              </Badge>
            </div>

            {issue.assignee && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-secondary">Assignee:</span>
                <div className="flex items-center gap-2">
                  <div className="bg-primary/20 flex size-6 items-center justify-center rounded-full">
                    <User className="text-primary size-3" />
                  </div>
                  <span className="text-text-dark text-sm font-medium">{issue.assignee.name}</span>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          {issue.description && (
            <div className="w-full space-y-3 whitespace-pre-wrap">
              <h3 className="text-text-dark text-lg font-semibold">Description</h3>
              <div className="rounded-lg border border-border bg-background-secondary/30 p-4">
                {parseMarkdownLinks(issue.description).map((part, index) => (
                  part.type === "text" ? (
                    <span key={index}>{part.content}</span>
                  ) : (
                    <a
                      key={index}
                      href={part.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      Link
                    </a>
                  )
                ))}
              </div>
            </div>
          )}

          {/* Labels */}
          {issue.labels.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-text-dark text-lg font-semibold">Labels</h3>
              <div className="flex flex-wrap gap-2">
                {issue.labels.map((label) => (
                  <Badge 
                    key={label.name}
                    variant="outline"
                    className="px-3 py-1.5 text-sm font-medium"
                    style={{ 
                      borderColor: label.color + "40",
                      color: label.color,
                      backgroundColor: label.color + "10"
                    }}
                  >
                    {label.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* External Link */}
          <div className="border-t border-border pt-4">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(`https://linear.app/issue/${issue.id}`, "_blank")}
            >
              <ExternalLink className="mr-2 size-4" />
              View in Linear
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
