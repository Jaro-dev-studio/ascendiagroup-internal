"use client";

import React, { useState, useMemo, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Search,
  Plus,
  Image as ImageIcon,
  Upload,
  X,
  ExternalLink,
  Trash2,
  Loader2,
  ArrowUpDown,
} from "lucide-react";
import type { AdLibraryItem } from "@prisma/client";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

interface AdLibraryClientProps {
  initialItems: AdLibraryItem[];
}

type SortOption = "newest" | "oldest";

// ============================================================================
// Components
// ============================================================================

interface LibraryCardProps {
  item: AdLibraryItem;
  onClick: () => void;
}

function LibraryCard({ item, onClick }: LibraryCardProps) {
  return (
    <Card
      className="group cursor-pointer overflow-hidden transition-shadow hover:shadow-md"
      onClick={onClick}
    >
      <div className="relative aspect-[9/16] bg-secondary-100">
        <img
          src={item.imageUrl}
          alt={item.title || "Ad inspiration"}
          className="size-full object-contain"
          loading="lazy"
        />
      </div>

      <div className="p-4">
        {item.title && (
          <h3 className="line-clamp-2 text-sm font-semibold text-secondary-900">
            {item.title}
          </h3>
        )}
        {item.description && (
          <p className="mt-1 line-clamp-2 text-xs text-secondary-500">
            {item.description}
          </p>
        )}
        {item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
            {item.tags.length > 3 && (
              <Badge variant="secondary" className="text-xs">
                +{item.tags.length - 3}
              </Badge>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function LibraryCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <Skeleton className="aspect-[9/16] w-full" />
      <div className="p-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="mt-1 h-4 w-full" />
        <div className="mt-2 flex gap-1">
          <Skeleton className="h-5 w-12" />
          <Skeleton className="h-5 w-16" />
        </div>
      </div>
    </Card>
  );
}

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: AdLibraryItem) => void;
}

function AddItemModal({ isOpen, onClose, onAdd }: AddItemModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [description, setDescription] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setImageUrl("");
    setImagePreview(null);
    setTitle("");
    setSourceUrl("");
    setDescription("");
    setTagsInput("");
    setIsDragActive(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const processFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (10MB max)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload to Vercel Blob
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("context", "ad-library");

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setImageUrl(data.url);
      toast.success("Image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to upload image");
      setImagePreview(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!imageUrl) {
      toast.error("Please upload an image");
      return;
    }

    setIsSaving(true);
    try {
      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const response = await fetch("/api/ad-library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl,
          title: title || null,
          sourceUrl: sourceUrl || null,
          description: description || null,
          tags,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save");
      }

      toast.success("Ad saved to library");
      onAdd(data.data);
      handleClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save ad");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Ad Inspiration</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Image *</Label>
            <div
              className={`relative flex aspect-video cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                isDragActive
                  ? "border-primary-500 bg-primary-50"
                  : "border-secondary-300 bg-secondary-50 hover:border-primary-400 hover:bg-secondary-100"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragEnter={handleDragEnter}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              {imagePreview ? (
                <>
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="size-full rounded-lg object-contain"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50">
                      <Loader2 className="size-8 animate-spin text-white" />
                    </div>
                  )}
                </>
              ) : isDragActive ? (
                <>
                  <Upload className="mb-2 size-8 text-primary-500" />
                  <p className="text-sm font-medium text-primary-600">
                    Drop image here
                  </p>
                </>
              ) : (
                <>
                  <Upload className="mb-2 size-8 text-secondary-400" />
                  <p className="text-sm text-secondary-600">
                    Click or drag and drop an image
                  </p>
                  <p className="text-xs text-secondary-400">
                    PNG, JPG, GIF, WebP up to 10MB
                  </p>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="e.g., Facebook carousel ad example"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Source URL */}
          <div className="space-y-2">
            <Label htmlFor="sourceUrl">Source URL</Label>
            <Input
              id="sourceUrl"
              placeholder="https://..."
              value={sourceUrl}
              onChange={(e) => setSourceUrl(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Notes about this ad..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              placeholder="meta, carousel, saas (comma-separated)"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
            />
            <p className="text-xs text-secondary-500">
              Separate tags with commas
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!imageUrl || isUploading || isSaving}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save to Library"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ItemDetailModalProps {
  item: AdLibraryItem | null;
  isOpen: boolean;
  onClose: () => void;
  onDelete: (id: string) => void;
}

function ItemDetailModal({ item, isOpen, onClose, onDelete }: ItemDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!item) return null;

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this item?")) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/ad-library/${item.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete");
      }

      toast.success("Item deleted");
      onDelete(item.id);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item.title || "Ad Inspiration"}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Image */}
          <div className="overflow-hidden rounded-lg bg-secondary-100">
            <img
              src={item.imageUrl}
              alt={item.title || "Ad inspiration"}
              className="size-full object-contain"
            />
          </div>

          {/* Details */}
          <div className="space-y-4">
            {item.description && (
              <div>
                <p className="text-xs font-medium text-secondary-500">Description</p>
                <p className="mt-1 text-sm text-secondary-700">{item.description}</p>
              </div>
            )}

            {item.sourceUrl && (
              <div>
                <p className="text-xs font-medium text-secondary-500">Source</p>
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 flex items-center gap-1 text-sm text-primary-600 hover:underline"
                >
                  {item.sourceUrl}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}

            {item.tags.length > 0 && (
              <div>
                <p className="text-xs font-medium text-secondary-500">Tags</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {item.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-secondary-500">Added</p>
              <p className="mt-1 text-sm text-secondary-700">
                {new Date(item.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>

            <div className="pt-4">
              <Button
                variant="outline"
                className="text-danger-600 hover:bg-danger-50 hover:text-danger-700"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 size-4" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function AdLibraryClient({ initialItems }: AdLibraryClientProps) {
  const [items, setItems] = useState<AdLibraryItem[]>(initialItems);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOption>("newest");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<AdLibraryItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Filter and sort items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((item) => {
        const matchesTitle = item.title?.toLowerCase().includes(query);
        const matchesDescription = item.description?.toLowerCase().includes(query);
        const matchesTags = item.tags.some((tag) =>
          tag.toLowerCase().includes(query)
        );
        return matchesTitle || matchesDescription || matchesTags;
      });
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [items, searchQuery, sortOrder]);

  const handleAddItem = useCallback((newItem: AdLibraryItem) => {
    setItems((prev) => [newItem, ...prev]);
  }, []);

  const handleDeleteItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleItemClick = (item: AdLibraryItem) => {
    setSelectedItem(item);
    setIsDetailModalOpen(true);
  };

  const handleCloseDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedItem(null);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-secondary-400" />
            <Input
              placeholder="Search by title, description, or tags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as SortOption)}>
            <SelectTrigger className="w-full sm:w-40">
              <ArrowUpDown className="mr-2 size-4" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest first</SelectItem>
              <SelectItem value="oldest">Oldest first</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={() => setIsAddModalOpen(true)}>
            <Plus className="mr-2 size-4" />
            Add Inspiration
          </Button>
        </div>

        <p className="mt-3 text-sm text-secondary-500">
          {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
        </p>
      </Card>

      {/* Empty State */}
      {filteredItems.length === 0 && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <ImageIcon className="size-12 text-secondary-300" />
            <h3 className="mt-4 text-lg font-semibold text-secondary-900">
              {items.length === 0 ? "No saved ads yet" : "No matches found"}
            </h3>
            <p className="mt-2 text-secondary-500">
              {items.length === 0
                ? "Start saving ads for inspiration by clicking the button above."
                : "Try adjusting your search to see more results."}
            </p>
            {items.length === 0 && (
              <Button className="mt-4" onClick={() => setIsAddModalOpen(true)}>
                <Plus className="mr-2 size-4" />
                Add Your First Ad
              </Button>
            )}
            {searchQuery && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => setSearchQuery("")}
              >
                Clear Search
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Grid */}
      {filteredItems.length > 0 && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => (
            <LibraryCard
              key={item.id}
              item={item}
              onClick={() => handleItemClick(item)}
            />
          ))}
        </div>
      )}

      {/* Add Modal */}
      <AddItemModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddItem}
      />

      {/* Detail Modal */}
      <ItemDetailModal
        item={selectedItem}
        isOpen={isDetailModalOpen}
        onClose={handleCloseDetailModal}
        onDelete={handleDeleteItem}
      />
    </div>
  );
}
