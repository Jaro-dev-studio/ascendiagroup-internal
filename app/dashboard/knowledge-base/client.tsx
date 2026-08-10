"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  Upload,
  Plus,
  Trash2,
  FileText,
  FileUp,
  RefreshCw,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  createManualDocument,
  createDocumentFromUpload,
  deleteDocument,
  retryProcessDocument,
} from "@/lib/actions/knowledge-base";
import { RichTextEditor } from "./rich-text-editor";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

interface KnowledgeBaseDocument {
  id: string;
  title: string;
  content: string;
  sourceType: string;
  fileUrl: string | null;
  fileName: string | null;
  mimeType: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  _count: {
    chunks: number;
  };
}

interface KnowledgeBaseClientProps {
  documents: KnowledgeBaseDocument[];
}

export function KnowledgeBaseClient({ documents }: KnowledgeBaseClientProps) {
  const router = useRouter();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;

    setIsCreating(true);
    try {
      const result = await createManualDocument(newTitle, newContent);
      if (result.error) {
        alert(result.error);
        return;
      }
      setIsCreateOpen(false);
      setNewTitle("");
      setNewContent("");
      router.refresh();
    } catch {
      alert("Failed to create document");
    } finally {
      setIsCreating(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("context", "knowledge-base");

      const uploadResponse = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        const err = await uploadResponse.json();
        alert(err.error || "Upload failed");
        return;
      }

      const { url, name, type } = await uploadResponse.json();

      const result = await createDocumentFromUpload(url, name, type);
      if (result.error) {
        alert(result.error);
        return;
      }

      setIsUploadOpen(false);
      setUploadFile(null);
      router.refresh();
    } catch {
      alert("Failed to upload document");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document?")) return;

    setIsDeleting(id);
    try {
      const result = await deleteDocument(id);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to delete document");
    } finally {
      setIsDeleting(null);
    }
  };

  const handleRetry = async (id: string) => {
    setIsRetrying(id);
    try {
      const result = await retryProcessDocument(id);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    } catch {
      alert("Failed to retry processing");
    } finally {
      setIsRetrying(null);
    }
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadFile(e.dataTransfer.files[0]);
    }
  }, []);

  const statusConfig: Record<
    string,
    { icon: React.ReactNode; label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    READY: {
      icon: <CheckCircle2 className="size-3" />,
      label: "Ready",
      variant: "default",
    },
    PROCESSING: {
      icon: <Clock className="size-3 animate-spin" />,
      label: "Processing",
      variant: "secondary",
    },
    FAILED: {
      icon: <AlertCircle className="size-3" />,
      label: "Failed",
      variant: "destructive",
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Base</h1>
          <p className="text-sm text-secondary-500">
            Documents and reference materials for AI context
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsUploadOpen(true)}>
            <Upload className="mr-2 size-4" />
            Upload Document
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="mr-2 size-4" />
            Create Document
          </Button>
        </div>
      </div>

      {documents.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center">
          <BookOpen className="mb-4 size-12 text-secondary-300" />
          <h3 className="text-lg font-semibold">No documents yet</h3>
          <p className="mt-1 text-sm text-secondary-500">
            Upload files or create documents to build your knowledge base. The
            AI chat will use these to provide informed responses.
          </p>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" onClick={() => setIsUploadOpen(true)}>
              <Upload className="mr-2 size-4" />
              Upload Document
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 size-4" />
              Create Document
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            const status = statusConfig[doc.status] || statusConfig.PROCESSING;
            return (
              <Card key={doc.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-start gap-3">
                    {doc.sourceType === "UPLOAD" ? (
                      <FileUp className="mt-0.5 size-5 shrink-0 text-secondary-400" />
                    ) : (
                      <FileText className="mt-0.5 size-5 shrink-0 text-secondary-400" />
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate font-medium leading-tight">
                        {doc.title}
                      </h3>
                      {doc.fileName && (
                        <p className="mt-0.5 truncate text-xs text-secondary-400">
                          {doc.fileName}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    {doc.status === "FAILED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetry(doc.id)}
                        disabled={isRetrying === doc.id}
                        className="size-8 p-0"
                      >
                        {isRetrying === doc.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                      disabled={isDeleting === doc.id}
                      className="size-8 p-0 text-destructive hover:text-destructive"
                    >
                      {isDeleting === doc.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Trash2 className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <p className="mt-3 line-clamp-2 text-xs text-secondary-500">
                  {doc.content.substring(0, 200)}
                  {doc.content.length > 200 && "..."}
                </p>

                <div className="mt-auto flex items-center justify-between pt-3">
                  <div className="flex items-center gap-2">
                    <Badge variant={status.variant} className="gap-1 text-xs">
                      {status.icon}
                      {status.label}
                    </Badge>
                    {doc.status === "READY" && (
                      <span className="text-xs text-secondary-400">
                        {doc._count.chunks} chunks
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-secondary-400">
                    {dayjs(doc.createdAt).fromNow()}
                  </span>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Document Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Document title"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <RichTextEditor
              content={newContent}
              onChange={setNewContent}
              placeholder="Write or paste your document content here..."
            />
          </div>
          <DialogFooter>
            <Button onClick={handleCreate} disabled={isCreating || !newTitle.trim() || !newContent.trim()}>
              {isCreating && <Loader2 className="mr-2 size-4 animate-spin" />}
              Create Document
            </Button>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Document Dialog */}
      <Dialog open={isUploadOpen} onOpenChange={setIsUploadOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
          </DialogHeader>
          <div
            className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors ${
              dragActive
                ? "border-primary bg-primary/5"
                : "border-secondary-300"
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {uploadFile ? (
              <div className="flex flex-col items-center gap-2">
                <FileUp className="text-primary size-8" />
                <p className="text-sm font-medium">{uploadFile.name}</p>
                <p className="text-xs text-secondary-400">
                  {(uploadFile.size / 1024).toFixed(1)} KB
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUploadFile(null)}
                >
                  Remove
                </Button>
              </div>
            ) : (
              <>
                <Upload className="mb-2 size-8 text-secondary-400" />
                <p className="text-sm text-secondary-500">
                  Drag and drop a file here, or click to browse
                </p>
                <p className="mt-1 text-xs text-secondary-400">
                  Supports PDF, TXT, and MD files
                </p>
                <input
                  type="file"
                  accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
                  className="absolute inset-0 cursor-pointer opacity-0"
                  onChange={(e) => {
                    if (e.target.files?.[0]) {
                      setUploadFile(e.target.files[0]);
                    }
                  }}
                />
              </>
            )}
          </div>
          <DialogFooter>
            <Button onClick={handleUpload} disabled={isUploading || !uploadFile}>
              {isUploading && (
                <Loader2 className="mr-2 size-4 animate-spin" />
              )}
              Upload & Process
            </Button>
            <Button variant="outline" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
