"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { CreateTaskModal, CreateTaskFormData, CreateTaskPayload } from "./create-task-modal";
import { createTask } from "@/lib/actions";
import { useRouter } from "next/navigation";

interface CreateTaskModalContextProps {
  openCreateTaskModal: () => void;
  closeCreateTaskModal: () => void;
  isOpen: boolean;
}

const CreateTaskModalContext = createContext<CreateTaskModalContextProps | undefined>(undefined);

export function CreateTaskModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [prefetchedData, setPrefetchedData] = useState<CreateTaskFormData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingSavesRef = useRef(0);
  const hasFetchedRef = useRef(false);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/create-task-data");
      if (!response.ok) {
        throw new Error("Failed to fetch data");
      }
      const data = await response.json();
      setPrefetchedData({
        clientCompanies: data.clientCompanies || [],
        users: data.users || [],
      });
      hasFetchedRef.current = true;
    } catch (err) {
      setError("Failed to load data. Please try again.");
      console.error("Error fetching create task data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Beforeunload handler to prevent leaving with pending saves
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (pendingSavesRef.current > 0) {
        e.preventDefault();
        return "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  const handleSaveTask = useCallback(async (payload: CreateTaskPayload) => {
    pendingSavesRef.current += 1;

    try {
      const result = await createTask(payload);

      if (result.error) {
        console.error("Failed to create task:", result.error);
        return;
      }

      router.push("/dashboard/tasks");
      router.refresh();
    } catch (err) {
      console.error("Failed to create task:", err);
    } finally {
      pendingSavesRef.current -= 1;
    }
  }, [router]);

  const openCreateTaskModal = useCallback(() => {
    setIsOpen(true);
    if (!hasFetchedRef.current && !isLoading) {
      fetchData();
    }
  }, [fetchData, isLoading]);
  const closeCreateTaskModal = () => setIsOpen(false);

  return (
    <CreateTaskModalContext.Provider value={{ openCreateTaskModal, closeCreateTaskModal, isOpen }}>
      {children}
      <CreateTaskModal
        isOpen={isOpen}
        onClose={closeCreateTaskModal}
        prefetchedData={prefetchedData}
        isDataLoading={isLoading}
        dataError={error}
        onRetry={fetchData}
        onSave={handleSaveTask}
      />
    </CreateTaskModalContext.Provider>
  );
}

export function useCreateTaskModal() {
  const context = useContext(CreateTaskModalContext);
  if (!context) {
    throw new Error("useCreateTaskModal must be used within a CreateTaskModalProvider");
  }
  return context;
}

/**
 * Safe version of useCreateTaskModal that doesn't throw when used outside the provider.
 * Returns null if the context is not available.
 * Useful for components that may render before hydration completes.
 */
export function useCreateTaskModalSafe() {
  const context = useContext(CreateTaskModalContext);
  return context ?? null;
}
