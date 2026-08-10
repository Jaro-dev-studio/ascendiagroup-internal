"use client";

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from "react";
import { CreateProjectModal } from "./create-project-modal";
import { createProject, checkCursorAgentStatus } from "@/lib/actions";

type ProjectStep = "form" | "creating" | "done" | "error";

interface ProjectProgress {
  githubCreated: boolean;
  vercelCreated: boolean;
  cursorLaunched: boolean;
  cursorStatus: string | null;
  cursorAgentUrl: string | null;
  error: string | null;
}

interface CreateProjectModalContextProps {
  openCreateProjectModal: () => void;
  closeCreateProjectModal: () => void;
  isOpen: boolean;
}

const CreateProjectModalContext = createContext<CreateProjectModalContextProps | undefined>(undefined);

const INITIAL_PROGRESS: ProjectProgress = {
  githubCreated: false,
  vercelCreated: false,
  cursorLaunched: false,
  cursorStatus: null,
  cursorAgentUrl: null,
  error: null,
};

export function CreateProjectModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<ProjectStep>("form");
  const [progress, setProgress] = useState<ProjectProgress>(INITIAL_PROGRESS);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const agentIdRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback((agentId: string) => {
    agentIdRef.current = agentId;
    
    const poll = async () => {
      if (!agentIdRef.current) return;
      
      try {
        const result = await checkCursorAgentStatus(agentIdRef.current);
        
        if (result.error) {
          console.error("Error polling cursor status:", result.error);
          return;
        }
        
        if (result.data) {
          setProgress((prev) => ({
            ...prev,
            cursorStatus: result.data!.status,
          }));
          
          // Stop polling if agent finished or errored
          if (result.data.status === "FINISHED" || result.data.status === "ERROR" || result.data.status === "STOPPED") {
            stopPolling();
            setStep(result.data.status === "FINISHED" ? "done" : "error");
            if (result.data.status !== "FINISHED") {
              setProgress((prev) => ({
                ...prev,
                error: `Cursor agent ${result.data!.status.toLowerCase()}`,
              }));
            }
          }
        }
      } catch (error) {
        console.error("Error polling cursor status:", error);
      }
    };
    
    // Poll immediately, then every 5 seconds
    poll();
    pollingRef.current = setInterval(poll, 5000);
  }, [stopPolling]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const handleCreateProject = useCallback(async (name: string, prompt: string) => {
    setStep("creating");
    setProgress(INITIAL_PROGRESS);
    
    try {
      // Simulate step progression for UX (the actual createDemo does all steps atomically)
      // We'll update progress as we go
      setProgress((prev) => ({ ...prev, githubCreated: false }));
      
      const result = await createProject({
        name,
        prompt,
      });
      
      if (result.error && !result.data) {
        // Complete failure
        setStep("error");
        setProgress((prev) => ({
          ...prev,
          error: result.error || "Failed to create project",
        }));
        return;
      }
      
      // Project created (even if cursor had an error, we have the demo)
      const demo = result.data;
      setProgress((prev) => ({
        ...prev,
        githubCreated: true,
        vercelCreated: true,
        cursorLaunched: !!demo?.cursorAgentId,
        cursorAgentUrl: demo?.cursorAgentUrl || null,
        cursorStatus: demo?.cursorAgentStatus || null,
        error: result.error || null,
      }));
      
      if (result.error) {
        // Partial failure (cursor failed but project exists)
        setStep("error");
        return;
      }
      
      // Start polling cursor agent status
      if (demo?.cursorAgentId) {
        startPolling(demo.cursorAgentId);
      } else {
        setStep("done");
      }
    } catch (error) {
      console.error("Error creating project:", error);
      setStep("error");
      setProgress((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : "Failed to create project",
      }));
    }
  }, [startPolling]);

  const openCreateProjectModal = useCallback(() => {
    setIsOpen(true);
    setStep("form");
    setProgress(INITIAL_PROGRESS);
  }, []);

  const closeCreateProjectModal = useCallback(() => {
    if (step === "creating") return; // Prevent closing during creation
    stopPolling();
    agentIdRef.current = null;
    setIsOpen(false);
    setStep("form");
    setProgress(INITIAL_PROGRESS);
  }, [step, stopPolling]);

  return (
    <CreateProjectModalContext.Provider value={{ openCreateProjectModal, closeCreateProjectModal, isOpen }}>
      {children}
      <CreateProjectModal
        isOpen={isOpen}
        onClose={closeCreateProjectModal}
        onCreateProject={handleCreateProject}
        step={step}
        progress={progress}
      />
    </CreateProjectModalContext.Provider>
  );
}

export function useCreateProjectModal() {
  const context = useContext(CreateProjectModalContext);
  if (!context) {
    throw new Error("useCreateProjectModal must be used within a CreateProjectModalProvider");
  }
  return context;
}

/**
 * Safe version of useCreateProjectModal that doesn't throw when used outside the provider.
 * Returns null if the context is not available.
 */
export function useCreateProjectModalSafe() {
  const context = useContext(CreateProjectModalContext);
  return context ?? null;
}
