"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Search,
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ViewData, FilterState, SortDirection } from "./types";

// ============================================
// Save View Dialog
// ============================================

interface SaveViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (name: string) => Promise<void>;
  currentState: {
    viewMode: "table" | "board";
    sortColumn: string | null;
    sortDirection: SortDirection;
    filters: FilterState;
  };
}

export function SaveViewDialog({
  open,
  onOpenChange,
  onSave,
  currentState,
}: SaveViewDialogProps) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      setError("Please enter a name for the view");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSave(name.trim());
      setName("");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save view");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setName("");
    setError(null);
    onOpenChange(false);
  };

  const activeFilterCount = Object.values(currentState.filters).filter((v) => {
    if (v === null || v === undefined) return false;
    if (typeof v === "string") return v !== "";
    if (Array.isArray(v)) return v.length > 0;
    return false;
  }).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save Current View</DialogTitle>
          <DialogDescription>
            Save your current filters, sort settings, and view mode as a named view.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Input
              placeholder="View name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  handleSave();
                }
              }}
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-danger-600">{error}</p>
            )}
          </div>
          <div className="rounded-md bg-secondary-50 p-3 text-sm">
            <p className="mb-2 font-medium text-secondary-700">This view will save:</p>
            <ul className="space-y-1 text-secondary-600">
              <li>View mode: {currentState.viewMode === "table" ? "Table" : "Board"}</li>
              {currentState.sortColumn && (
                <li>Sort: {currentState.sortColumn} ({currentState.sortDirection})</li>
              )}
              {activeFilterCount > 0 && (
                <li>{activeFilterCount} active filter{activeFilterCount !== 1 ? "s" : ""}</li>
              )}
            </ul>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={!name.trim() || isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save View"
            )}
          </Button>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// Load View Dialog
// ============================================

interface LoadViewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  views: ViewData[];
  currentViewId: string | undefined;
  onLoad: (view: ViewData) => void;
  onUpdate: (id: string, data: Partial<ViewData>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function LoadViewDialog({
  open,
  onOpenChange,
  views,
  currentViewId,
  onLoad,
  onUpdate,
  onDelete,
}: LoadViewDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const filteredViews = useMemo(() => {
    if (!searchQuery.trim()) return views;
    return views.filter((view) =>
      view.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [views, searchQuery]);

  const handleClose = () => {
    setSearchQuery("");
    setEditingId(null);
    setEditingName("");
    onOpenChange(false);
  };

  const handleStartRename = (view: ViewData) => {
    setEditingId(view.id);
    setEditingName(view.name);
  };

  const handleConfirmRename = async () => {
    if (!editingId || !editingName.trim()) return;
    await onUpdate(editingId, { name: editingName.trim() });
    setEditingId(null);
    setEditingName("");
  };

  const handleCancelRename = () => {
    setEditingId(null);
    setEditingName("");
  };

  const handleDelete = async (id: string) => {
    await onDelete(id);
  };

  const handleLoad = (view: ViewData) => {
    onLoad(view);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Saved Views</DialogTitle>
          <DialogDescription>
            Load a saved view or manage your existing views.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-secondary" />
            <Input
              placeholder="Search views..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="max-h-[400px] space-y-1 overflow-y-auto">
            {filteredViews.length === 0 ? (
              <div className="py-8 text-center text-sm text-text-secondary">
                {views.length === 0
                  ? "No saved views yet. Save your first view using the \"Save View\" button."
                  : "No views match your search."}
              </div>
            ) : (
              filteredViews.map((view) => {
                const isCurrentView = currentViewId === view.id;
                const isEditing = editingId === view.id;
                const filterCount = Object.values(view.filters).filter((v) => {
                  if (v === null || v === undefined) return false;
                  if (typeof v === "string") return v !== "";
                  if (Array.isArray(v)) return v.length > 0;
                  return false;
                }).length;

                return (
                  <div
                    key={view.id}
                    className={`group flex items-center gap-3 rounded-md p-3 transition-colors ${
                      isCurrentView
                        ? "border border-primary-200 bg-primary-50"
                        : "hover:bg-secondary-50"
                    }`}
                  >
                    {isEditing ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleConfirmRename();
                            if (e.key === "Escape") handleCancelRename();
                          }}
                          className="h-8 flex-1"
                          autoFocus
                        />
                        <Button size="sm" onClick={handleConfirmRename} className="h-8">
                          <Check className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={handleCancelRename} className="h-8">
                          <X className="size-4" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div
                          className="flex flex-1 cursor-pointer flex-col"
                          onClick={() => handleLoad(view)}
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{view.name}</span>
                            {isCurrentView && (
                              <Badge className="border-primary-200 bg-primary-100 text-primary-700">
                                Current
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-text-secondary">
                            {view.viewMode === "table" ? "Table" : "Board"}
                            {view.sortColumn && ` - Sorted by ${view.sortColumn}`}
                            {filterCount > 0 && ` - ${filterCount} filter${filterCount !== 1 ? "s" : ""}`}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleStartRename(view)}
                            className="size-8 p-0"
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDelete(view.id)}
                            className="size-8 p-0 text-danger-600 hover:text-danger-700"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
