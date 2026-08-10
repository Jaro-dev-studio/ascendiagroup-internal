"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, ExternalLink, RefreshCw, AlertCircle, Github, Code, Triangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { regenerateDemo } from "@/lib/actions";

interface DemoViewerProps {
  demoId: string;
  demoName: string;
  status: string;
  vercelDeployUrl: string | null;
  githubRepoUrl: string | null;
  githubRepoName: string | null;
  cursorAgentUrl: string | null;
  errorMessage: string | null;
  isAdmin: boolean;
}

export function DemoViewer({
  demoId,
  demoName,
  status,
  vercelDeployUrl,
  githubRepoUrl,
  githubRepoName,
  cursorAgentUrl,
  errorMessage,
  isAdmin,
}: DemoViewerProps) {
  const [currentStatus, setCurrentStatus] = useState(status);
  const [currentDeployUrl, setCurrentDeployUrl] = useState(vercelDeployUrl);
  const [currentError, setCurrentError] = useState(errorMessage);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Poll for status updates when generating or deploying
  useEffect(() => {
    if (currentStatus !== "generating" && currentStatus !== "deploying") {
      return;
    }

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/demos/${demoId}`);
        if (response.ok) {
          const data = await response.json();
          if (data.data) {
            setCurrentStatus(data.data.status);
            setCurrentDeployUrl(data.data.vercelDeployUrl);
            setCurrentError(data.data.errorMessage);
          }
        }
      } catch (err) {
        console.error("Error polling demo status:", err);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(pollInterval);
  }, [demoId, currentStatus]);

  const handleRegenerate = async () => {
    if (isRegenerating) return;

    if (!confirm("Are you sure you want to regenerate this demo? This will launch a new AI agent.")) {
      return;
    }

    setIsRegenerating(true);
    setCurrentError(null);

    try {
      const result = await regenerateDemo(demoId);
      if (result.error) {
        setCurrentError(result.error);
      } else {
        setCurrentStatus("generating");
      }
    } catch (err) {
      setCurrentError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleOpenGitHub = () => {
    if (githubRepoUrl) {
      window.open(githubRepoUrl, "_blank");
    }
  };

  const handleOpenDeployment = () => {
    if (currentDeployUrl) {
      window.open(currentDeployUrl, "_blank");
    }
  };

  const handleRefreshIframe = () => {
    if (iframeRef.current && currentDeployUrl) {
      iframeRef.current.src = currentDeployUrl;
    }
  };

  // Show loading state for pending/generating, or deploying without an existing URL
  if (currentStatus === "pending" || currentStatus === "generating" || (currentStatus === "deploying" && !currentDeployUrl)) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-secondary-50">
        <div className="text-center">
          <Loader2 className="mx-auto size-12 animate-spin text-primary-500" />
          <h1 className="mt-6 text-2xl font-bold text-secondary-900">{demoName}</h1>
          <p className="mt-2 text-secondary-600">
            {currentStatus === "pending" && "Initializing demo generation..."}
            {currentStatus === "generating" && "AI is building your demo..."}
            {currentStatus === "deploying" && "Deploying to Vercel..."}
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-secondary-500">
            <div className="size-2 animate-pulse rounded-full bg-primary-500" />
            <span>This may take a few minutes</span>
          </div>

          {githubRepoUrl && isAdmin && (
            <Button
              onClick={handleOpenGitHub}
              variant="outline"
              size="sm"
              className="mt-6 gap-2"
            >
              <Github className="size-4" />
              View on GitHub
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Show error state
  if (currentStatus === "failed") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-secondary-50">
        <div className="text-center">
          <AlertCircle className="mx-auto size-12 text-danger-500" />
          <h1 className="mt-6 text-2xl font-bold text-secondary-900">{demoName}</h1>
          <p className="mt-2 text-danger-600">
            {currentError || "Demo generation failed"}
          </p>

          <div className="mt-6 flex items-center justify-center gap-3">
            {isAdmin && (
              <Button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="gap-2"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Regenerating...
                  </>
                ) : (
                  <>
                    <RefreshCw className="size-4" />
                    Retry Generation
                  </>
                )}
              </Button>
            )}
            {githubRepoUrl && isAdmin && (
              <Button
                onClick={handleOpenGitHub}
                variant="outline"
                className="gap-2"
              >
                <Github className="size-4" />
                View on GitHub
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Show the deployed demo (also when deploying but we have an existing URL)
  if ((currentStatus === "ready" || currentStatus === "deploying") && currentDeployUrl) {
    return (
      <>
        {/* Demo iframe */}
        <iframe
          ref={iframeRef}
          src={currentDeployUrl}
          className="fixed inset-0 size-full border-0"
          title={demoName}
          allow="clipboard-write"
        />

        {/* Deploying indicator */}
        {currentStatus === "deploying" && (
          <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-lg bg-warning-100 px-3 py-2 text-sm text-warning-700 shadow-lg">
            <Loader2 className="size-4 animate-spin" />
            New deployment in progress...
          </div>
        )}

        {/* Admin controls */}
        {isAdmin && (
          <div className="fixed bottom-4 right-4 z-50 flex gap-2">
            {githubRepoUrl && (
              <Button
                onClick={handleOpenGitHub}
                size="sm"
                variant="outline"
                className="gap-2 bg-white shadow-lg"
              >
                <Github className="size-4" />
                <span className="hidden sm:inline">GitHub</span>
              </Button>
            )}
            {githubRepoName && (
              <Button
                onClick={() => window.open(`https://vercel.com/staz-limited/${githubRepoName}`, "_blank")}
                size="sm"
                variant="outline"
                className="gap-2 bg-white shadow-lg"
              >
                <Triangle className="size-4" />
                <span className="hidden sm:inline">Vercel</span>
              </Button>
            )}
            {cursorAgentUrl && (
              <Button
                onClick={() => window.open(cursorAgentUrl, "_blank")}
                size="sm"
                variant="outline"
                className="gap-2 bg-white shadow-lg"
              >
                <Code className="size-4" />
                <span className="hidden sm:inline">Cursor</span>
              </Button>
            )}
          </div>
        )}
      </>
    );
  }

  // Fallback for unknown state
  return (
    <div className="flex h-screen items-center justify-center bg-secondary-50">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-secondary-900">{demoName}</h1>
        <p className="mt-2 text-secondary-600">
          This demo is not available yet.
        </p>
        <p className="mt-1 text-sm text-secondary-500">
          Status: {currentStatus}
        </p>
      </div>
    </div>
  );
}
