"use client";

import { useState } from "react";
import { RefreshCw, Loader2, Clock, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onSync: (fullSync: boolean) => Promise<void>;
}

export function SyncModal({
  open,
  onOpenChange,
  title,
  description,
  onSync,
}: SyncModalProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncType, setSyncType] = useState<"incremental" | "full" | null>(null);

  const handleSync = async (fullSync: boolean) => {
    setIsSyncing(true);
    setSyncType(fullSync ? "full" : "incremental");
    try {
      await onSync(fullSync);
    } finally {
      setIsSyncing(false);
      setSyncType(null);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={isSyncing ? undefined : onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-text-secondary">{description}</p>
        <div className="flex flex-col gap-3">
          <button
            className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-background-secondary/50 disabled:opacity-50"
            onClick={() => handleSync(false)}
            disabled={isSyncing}
          >
            <div className="bg-primary/10 rounded-lg p-2">
              {isSyncing && syncType === "incremental" ? (
                <Loader2 className="text-primary size-5 animate-spin" />
              ) : (
                <Clock className="text-primary size-5" />
              )}
            </div>
            <div>
              <p className="text-text-dark text-sm font-medium">Incremental Sync</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Only fetch new and updated records since the last sync. Faster and recommended for regular use.
              </p>
            </div>
          </button>
          <button
            className="flex items-start gap-3 rounded-lg border border-border p-4 text-left transition-colors hover:bg-background-secondary/50 disabled:opacity-50"
            onClick={() => handleSync(true)}
            disabled={isSyncing}
          >
            <div className="rounded-lg bg-warning-100 p-2">
              {isSyncing && syncType === "full" ? (
                <Loader2 className="size-5 animate-spin text-warning-700" />
              ) : (
                <Database className="size-5 text-warning-700" />
              )}
            </div>
            <div>
              <p className="text-text-dark text-sm font-medium">Full Sync</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                Re-fetch all records from the beginning. Takes longer but ensures complete data. Use if data seems incomplete.
              </p>
            </div>
          </button>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSyncing}
          >
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
