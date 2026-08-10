"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  BookOpen,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  Pencil,
  Plus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  askKnowledgeBase,
  buildClaudeProjectContext,
  deleteKnowledgeDocument,
  linkClaudeProject,
  saveKnowledgeDocument,
} from "@/lib/actions/knowledge";
import { cn, formatRelative, titleCase } from "@/lib/utils";

interface KnowledgeDocument {
  id: string;
  title: string;
  source: string;
  content: string;
  tags: string[];
  updatedAt: Date;
  createdBy: { name: string | null; email: string } | null;
}

interface ChatMessage {
  id: string;
  role: string;
  content: string;
  contextTitles: string[];
  createdAt: Date;
}

const SOURCES = ["MANUAL", "ONBOARDING", "TRANSCRIPT", "WHATSAPP", "STRATEGY"];

export function KnowledgeBaseClient({
  clients,
  activeClientId,
  client,
  documents,
  conversation,
  isClaudeConnected,
  error,
}: {
  clients: { id: string; name: string; documentCount: number }[];
  activeClientId: string;
  client: {
    id: string;
    name: string;
    claudeProjectId: string | null;
    claudeProjectUrl: string | null;
    claudeSyncedAt: Date | null;
  } | null;
  documents: KnowledgeDocument[];
  conversation: { id: string; messages: ChatMessage[] } | null;
  isClaudeConnected: boolean;
  error: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [documentDraft, setDocumentDraft] = useState<{
    id?: string;
    title: string;
    content: string;
    source: string;
    tags: string;
  } | null>(null);
  const [isSavingDocument, setIsSavingDocument] = useState(false);
  const [isLinkOpen, setIsLinkOpen] = useState(false);
  const [claudeProject, setClaudeProject] = useState({
    projectId: client?.claudeProjectId ?? "",
    projectUrl: client?.claudeProjectUrl ?? "",
  });
  const [isLinking, setIsLinking] = useState(false);

  const [messages, setMessages] = useState<
    { role: string; content: string; contextTitles: string[] }[]
  >(
    conversation?.messages.map((message) => ({
      role: message.role,
      content: message.content,
      contextTitles: message.contextTitles,
    })) ?? []
  );
  const [conversationId, setConversationId] = useState(conversation?.id);
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages(
      conversation?.messages.map((message) => ({
        role: message.role,
        content: message.content,
        contextTitles: message.contextTitles,
      })) ?? []
    );
    setConversationId(conversation?.id);
    setClaudeProject({
      projectId: client?.claudeProjectId ?? "",
      projectUrl: client?.claudeProjectUrl ?? "",
    });
  }, [conversation, client]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function selectClient(value: string) {
    router.push(`/dashboard/knowledge-base?clientId=${value}`);
  }

  async function onSaveDocument(event: React.FormEvent) {
    event.preventDefault();
    if (!documentDraft) return;

    setIsSavingDocument(true);
    try {
      const { error: saveError } = await saveKnowledgeDocument({
        id: documentDraft.id,
        clientId: activeClientId,
        title: documentDraft.title,
        content: documentDraft.content,
        source: documentDraft.source,
        tags: documentDraft.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
      });

      if (saveError) {
        toast.error(saveError);
        return;
      }

      toast.success("Document saved.");
      setDocumentDraft(null);
      router.refresh();
    } finally {
      setIsSavingDocument(false);
    }
  }

  function onDeleteDocument(id: string) {
    startTransition(async () => {
      const { error: deleteError } = await deleteKnowledgeDocument(id);
      if (deleteError) toast.error(deleteError);
      else router.refresh();
    });
  }

  async function onLinkClaude(event: React.FormEvent) {
    event.preventDefault();
    setIsLinking(true);

    try {
      const { error: linkError } = await linkClaudeProject({
        clientId: activeClientId,
        ...claudeProject,
      });

      if (linkError) {
        toast.error(linkError);
        return;
      }

      toast.success("Claude project linked.");
      setIsLinkOpen(false);
      router.refresh();
    } finally {
      setIsLinking(false);
    }
  }

  function onCopyContext() {
    startTransition(async () => {
      const { data, error: contextError } =
        await buildClaudeProjectContext(activeClientId);

      if (contextError || !data) {
        toast.error(contextError ?? "Something went wrong.");
        return;
      }

      await navigator.clipboard.writeText(data.content);
      toast.success(
        `Copied ${data.documents} documents. Paste them into the Claude project knowledge.`
      );
    });
  }

  async function onAsk(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;

    setMessages((current) => [
      ...current,
      { role: "USER", content: trimmed, contextTitles: [] },
    ]);
    setQuestion("");
    setIsAsking(true);

    try {
      const { data, error: askError } = await askKnowledgeBase({
        clientId: activeClientId,
        conversationId,
        question: trimmed,
      });

      if (askError || !data) {
        toast.error(askError ?? "Something went wrong.");
        setMessages((current) => current.slice(0, -1));
        return;
      }

      setConversationId(data.conversationId);
      setMessages((current) => [
        ...current,
        {
          role: "ASSISTANT",
          content: data.answer,
          contextTitles: data.contextTitles,
        },
      ]);
    } finally {
      setIsAsking(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Knowledge base"
        description="Everything the team knows about a practice, in one searchable place that Claude can answer from."
        actions={
          <>
            <Button variant="outline" onClick={() => setIsLinkOpen(true)}>
              <Link2 className="mr-2 size-4" />
              Claude project
            </Button>
            <Button
              onClick={() =>
                setDocumentDraft({
                  title: "",
                  content: "",
                  source: "MANUAL",
                  tags: "",
                })
              }
            >
              <Plus className="mr-2 size-4" />
              Add document
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="w-full sm:max-w-xs">
          <Select value={activeClientId} onValueChange={selectClient}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {clients.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name} ({option.documentCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {client?.claudeProjectUrl && (
          <a
            href={client.claudeProjectUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            Open Claude project
            <ExternalLink className="size-3.5" />
          </a>
        )}

        {client?.claudeSyncedAt && (
          <span className="text-xs text-muted-foreground">
            Linked {formatRelative(client.claudeSyncedAt)}
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-md border border-danger-100 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </p>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-5">
        <div className="flex flex-col gap-4 xl:col-span-3">
          {documents.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No documents for this client"
              description="Onboarding answers, call summaries and WhatsApp threads land here automatically. You can also add notes by hand."
              action={
                <Button
                  onClick={() =>
                    setDocumentDraft({
                      title: "",
                      content: "",
                      source: "MANUAL",
                      tags: "",
                    })
                  }
                >
                  <Plus className="mr-2 size-4" />
                  Add the first document
                </Button>
              }
            />
          ) : (
            documents.map((document) => (
              <Card key={document.id} className="group">
                <CardHeader className="flex-row items-start justify-between gap-3">
                  <div className="min-w-0">
                    <CardTitle>{document.title}</CardTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {titleCase(document.source)} ·{" "}
                      {formatRelative(document.updatedAt)}
                      {document.createdBy
                        ? ` · ${document.createdBy.name ?? document.createdBy.email}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit document"
                      onClick={() =>
                        setDocumentDraft({
                          id: document.id,
                          title: document.title,
                          content: document.content,
                          source: document.source,
                          tags: document.tags.join(", "),
                        })
                      }
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete document"
                      disabled={isPending}
                      onClick={() => onDeleteDocument(document.id)}
                    >
                      <Trash2 className="size-3.5 text-danger-600" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="line-clamp-4 whitespace-pre-wrap text-sm text-secondary-700">
                    {document.content}
                  </p>
                  {document.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {document.tags.map((tag) => (
                        <Badge key={tag} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Card className="flex h-[640px] flex-col xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between border-b border-border">
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              Ask Claude
            </CardTitle>
            <Button
              size="xs"
              variant="ghost"
              onClick={onCopyContext}
              disabled={isPending || documents.length === 0}
            >
              <Copy className="mr-1.5 size-3.5" />
              Export context
            </Button>
          </CardHeader>

          <CardContent className="flex min-h-0 flex-1 flex-col gap-4 p-4">
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto scrollbar-thin">
              {messages.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
                  <Sparkles className="size-6 text-primary-300" />
                  <p className="mt-3 text-sm font-medium text-secondary-900">
                    Ask about this client
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Claude answers using only this client&apos;s documents, so it can
                    quote their onboarding answers, calls and WhatsApp threads.
                  </p>
                </div>
              ) : (
                messages.map((message, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex flex-col gap-1",
                      message.role === "USER" ? "items-end" : "items-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[90%] rounded-lg px-3 py-2 text-sm",
                        message.role === "USER"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-secondary-800"
                      )}
                    >
                      {message.role === "USER" ? (
                        message.content
                      ) : (
                        <div className="prose-brand">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                    {message.contextTitles.length > 0 && (
                      <p className="text-[11px] text-muted-foreground">
                        Sources: {message.contextTitles.join(", ")}
                      </p>
                    )}
                  </div>
                ))
              )}
              {isAsking && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Claude is reading the knowledge base...
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {!isClaudeConnected && (
              <p className="rounded-md bg-warning-50 px-3 py-2 text-xs text-warning-700">
                Connect Claude under Integrations to enable the assistant.
              </p>
            )}

            <form onSubmit={onAsk} className="flex items-end gap-2">
              <Textarea
                rows={2}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    onAsk(event);
                  }
                }}
                placeholder="What did they say about their new patient goals?"
                disabled={!isClaudeConnected || documents.length === 0}
              />
              <Button
                type="submit"
                size="icon"
                aria-label="Send"
                disabled={isAsking || !isClaudeConnected || documents.length === 0}
              >
                {isAsking ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={documentDraft !== null}
        onOpenChange={(open) => !open && setDocumentDraft(null)}
      >
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto scrollbar-thin">
          <DialogHeader>
            <DialogTitle>
              {documentDraft?.id ? "Edit document" : "Add document"}
            </DialogTitle>
          </DialogHeader>

          {documentDraft && (
            <form onSubmit={onSaveDocument} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="docTitle">Title</Label>
                <Input
                  id="docTitle"
                  value={documentDraft.title}
                  onChange={(event) =>
                    setDocumentDraft({
                      ...documentDraft,
                      title: event.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="docSource">Source</Label>
                  <Select
                    value={documentDraft.source}
                    onValueChange={(value) =>
                      setDocumentDraft({ ...documentDraft, source: value })
                    }
                  >
                    <SelectTrigger id="docSource">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>
                          {titleCase(source)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="docTags">Tags</Label>
                  <Input
                    id="docTags"
                    value={documentDraft.tags}
                    onChange={(event) =>
                      setDocumentDraft({
                        ...documentDraft,
                        tags: event.target.value,
                      })
                    }
                    placeholder="brand, tone of voice"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="docContent">Content</Label>
                <Textarea
                  id="docContent"
                  rows={12}
                  value={documentDraft.content}
                  onChange={(event) =>
                    setDocumentDraft({
                      ...documentDraft,
                      content: event.target.value,
                    })
                  }
                  required
                />
              </div>

              <DialogFooter className="flex-row justify-end gap-2">
                <Button type="submit" disabled={isSavingDocument}>
                  {isSavingDocument && (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  )}
                  Save document
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDocumentDraft(null)}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isLinkOpen} onOpenChange={setIsLinkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Link a Claude project</DialogTitle>
            <DialogDescription>
              Create a project in Claude for this practice, paste the exported
              knowledge into it, then record the link here so the whole team opens
              the same context.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onLinkClaude} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="claudeProjectId">Claude project ID</Label>
              <Input
                id="claudeProjectId"
                value={claudeProject.projectId}
                onChange={(event) =>
                  setClaudeProject({
                    ...claudeProject,
                    projectId: event.target.value,
                  })
                }
                placeholder="01jk..."
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="claudeProjectUrl">Claude project URL</Label>
              <Input
                id="claudeProjectUrl"
                value={claudeProject.projectUrl}
                onChange={(event) =>
                  setClaudeProject({
                    ...claudeProject,
                    projectUrl: event.target.value,
                  })
                }
                placeholder="https://claude.ai/project/..."
              />
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button type="submit" disabled={isLinking}>
                {isLinking && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save link
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsLinkOpen(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
