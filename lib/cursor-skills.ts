import Database from "better-sqlite3";
import os from "os";
import path from "path";
import fs from "fs";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversationMessage {
  role: string;
  content: string;
}

interface Conversation {
  id: string;
  title: string;
  messages: ConversationMessage[];
  messageCount: number;
}

export interface WorkspaceInfo {
  id: string;
  name: string;
  path: string;
  conversationCount: number;
  conversations: {
    id: string;
    title: string;
    messageCount: number;
    preview: string;
  }[];
}

export interface ExportResult {
  name: string;
  conversations: Conversation[];
}

export interface GenerateResult {
  name: string;
  totalConversations: number;
  substantiveConversations: number;
  skills: {
    title: string;
    content: string;
    sourceConversation: string;
  }[];
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const CHAT_KEYS = [
  "workbench.panel.aichat.view.aichat.chatdata",
  "workbench.panel.chat.view.chat.chatdata",
  "vscode-chat.chatHistory",
];

const SKILL_SYSTEM_PROMPT = `You are an expert at converting AI coding conversations into reusable "skill" documents.

A "skill" is a self-contained prompt template that can be applied to ANY project to reproduce the same functionality. It should be written so that a developer can paste it into Cursor (or any AI coding assistant) and get the same result on their own codebase.

Given a conversation between a developer and an AI coding assistant, produce a skill document in the following format:

---

# Skill: [Descriptive Name]

## What This Does
[1-2 sentence description of the end result]

## Prerequisites
[What the developer needs to have set up before using this skill - frameworks, packages, etc.]

## The Prompt
[The actual prompt to paste into Cursor/AI assistant. This should be a refined, generalized version of what the developer asked for. Replace project-specific names with placeholders like {{APP_NAME}}, {{MODEL_NAME}}, etc. Include all the context the AI needs to produce good output.]

## Expected Output
[Brief description of what files/changes the AI should produce]

## Gotchas & Tips
[Any issues that came up in the original conversation, workarounds discovered, or important notes]

---

Rules:
- The prompt should be COMPLETE and SELF-CONTAINED - someone should be able to use it without reading the conversation
- Generalize away project-specific details but keep technical specifics that matter
- If the conversation involved multiple back-and-forth iterations to get something right, fold all the corrections into ONE clean prompt
- If the conversation covered multiple distinct features, create separate skills for each
- Keep it practical - no fluff
- The prompt section is the most important part - it should be copy-pasteable`;

function getWorkspaceStoragePath(): string {
  switch (process.platform) {
    case "darwin":
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Cursor",
        "User",
        "workspaceStorage"
      );
    case "win32":
      return path.join(
        process.env.APPDATA || "",
        "Cursor",
        "User",
        "workspaceStorage"
      );
    default:
      return path.join(
        os.homedir(),
        ".config",
        "Cursor",
        "User",
        "workspaceStorage"
      );
  }
}

// ---------------------------------------------------------------------------
// Database helpers
// ---------------------------------------------------------------------------

function getWorkspaceDirs(): string[] {
  const storagePath = getWorkspaceStoragePath();
  if (!fs.existsSync(storagePath)) {
    return [];
  }

  return fs
    .readdirSync(storagePath, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => path.join(storagePath, d.name))
    .filter((d) => fs.existsSync(path.join(d, "state.vscdb")))
    .map((d) => ({
      path: d,
      mtime: fs.statSync(path.join(d, "state.vscdb")).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime)
    .map((d) => d.path);
}

function getWorkspaceName(workspaceDir: string): string {
  const workspaceJson = path.join(workspaceDir, "workspace.json");
  if (fs.existsSync(workspaceJson)) {
    try {
      const data = JSON.parse(fs.readFileSync(workspaceJson, "utf-8"));
      const folder: string = data.folder || "";
      if (folder) {
        const parts = folder.split("/");
        return parts[parts.length - 1] || folder;
      }
    } catch {
      // ignore
    }
  }
  return path.basename(workspaceDir);
}

function queryDb(dbPath: string, key: string): string | null {
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });

    for (const table of ["ItemTable", "cursorDiskKV"]) {
      try {
        const stmt = db.prepare(
          `SELECT value FROM ${table} WHERE [key] = ?`
        );
        const row = stmt.get(key) as { value: string } | undefined;
        if (row?.value) {
          db.close();
          return row.value;
        }
      } catch {
        continue;
      }
    }

    db.close();
  } catch {
    // ignore
  }
  return null;
}

function queryDbKeysLike(
  dbPath: string,
  pattern: string
): [string, string][] {
  const results: [string, string][] = [];
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });

    for (const table of ["ItemTable", "cursorDiskKV"]) {
      try {
        const stmt = db.prepare(
          `SELECT [key], value FROM ${table} WHERE [key] LIKE ?`
        );
        const rows = stmt.all(pattern) as { key: string; value: string }[];
        results.push(...rows.map((r) => [r.key, r.value] as [string, string]));
      } catch {
        continue;
      }
    }

    db.close();
  } catch {
    // ignore
  }
  return results;
}

function listAllKeys(dbPath: string): string[] {
  const keys: string[] = [];
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });

    for (const table of ["ItemTable", "cursorDiskKV"]) {
      try {
        const stmt = db.prepare(`SELECT [key] FROM ${table}`);
        const rows = stmt.all() as { key: string }[];
        keys.push(...rows.map((r) => r.key));
      } catch {
        continue;
      }
    }

    db.close();
  } catch {
    // ignore
  }
  return keys;
}

// ---------------------------------------------------------------------------
// Chat extraction / parsing
// ---------------------------------------------------------------------------

function parseChatData(data: unknown): Conversation[] {
  const conversations: Conversation[] = [];

  let tabs: unknown[];
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const d = data as Record<string, unknown>;
    const raw = d.tabs || d.chatSessions || d.chats || [];
    tabs = Array.isArray(raw) ? raw : [data];
  } else if (Array.isArray(data)) {
    tabs = data;
  } else {
    return [];
  }

  for (const tab of tabs) {
    if (typeof tab !== "object" || tab === null) continue;
    const t = tab as Record<string, unknown>;

    const messages: ConversationMessage[] = [];
    const title = (t.title || t.name || "Untitled") as string;
    const chatId = (t.id || t.tabId || "unknown") as string;

    const rawMessages = (t.messages ||
      t.bubbles ||
      t.conversation ||
      []) as unknown[];
    if (!Array.isArray(rawMessages)) continue;

    for (const msg of rawMessages) {
      if (typeof msg !== "object" || msg === null) continue;
      const m = msg as Record<string, unknown>;

      let role = (m.role || m.type || m.sender || "unknown") as string;
      const content = m.content || m.text || m.message || "";

      if (["human", "user", "User"].includes(role)) role = "user";
      else if (["assistant", "ai", "bot", "Assistant", "AI"].includes(role))
        role = "assistant";

      if (typeof content === "string" && content) {
        messages.push({ role, content });
      } else if (Array.isArray(content)) {
        const textParts: string[] = [];
        for (const part of content) {
          if (typeof part === "string") textParts.push(part);
          else if (
            typeof part === "object" &&
            part !== null &&
            (part as Record<string, unknown>).text
          ) {
            textParts.push(
              (part as Record<string, unknown>).text as string
            );
          }
        }
        if (textParts.length > 0) {
          messages.push({ role, content: textParts.join("\n") });
        }
      }
    }

    if (messages.length > 0) {
      conversations.push({
        id: chatId,
        title,
        messages,
        messageCount: messages.length,
      });
    }
  }

  return conversations;
}

function parseComposerData(
  key: string,
  data: unknown
): Conversation | null {
  if (typeof data !== "object" || data === null) return null;
  const d = data as Record<string, unknown>;

  const messages: ConversationMessage[] = [];
  const title = (d.name ||
    d.title ||
    key.replace("composerData:", "")) as string;

  const rawMessages = (d.conversation ||
    d.messages ||
    d.richText ||
    []) as unknown[];
  if (!Array.isArray(rawMessages)) return null;

  for (const msg of rawMessages) {
    if (typeof msg !== "object" || msg === null) continue;
    const m = msg as Record<string, unknown>;

    let role = m.role || m.type || "unknown";
    let content = (m.content || m.text || m.message || "") as string;

    if (!content && m.parts) {
      const parts = m.parts as unknown[];
      if (Array.isArray(parts)) {
        const textParts: string[] = [];
        for (const part of parts) {
          if (typeof part === "string") textParts.push(part);
          else if (typeof part === "object" && part !== null) {
            const p = part as Record<string, unknown>;
            textParts.push((p.text || p.content || "") as string);
          }
        }
        content = textParts.filter(Boolean).join("\n");
      }
    }

    if ([1, "human", "user", "User"].includes(role as string | number))
      role = "user";
    else if (
      [2, "assistant", "ai", "bot", "Assistant", "AI"].includes(
        role as string | number
      )
    )
      role = "assistant";

    if (typeof content === "string" && content.trim()) {
      messages.push({ role: role as string, content });
    }
  }

  if (messages.length > 0) {
    return {
      id: key,
      title,
      messages,
      messageCount: messages.length,
    };
  }
  return null;
}

function parseAiServiceItem(item: unknown): Conversation | null {
  if (typeof item !== "object" || item === null) return null;
  const d = item as Record<string, unknown>;

  const content = (d.prompt || d.text || d.content || "") as string;
  if (!content) return null;

  return {
    id: (d.id || "unknown") as string,
    title: content.length > 80 ? content.slice(0, 80) + "..." : content,
    messages: [{ role: "user", content }],
    messageCount: 1,
  };
}

function parseGenericChatData(key: string, data: unknown): Conversation[] {
  const conversations: Conversation[] = [];

  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    for (const [, v] of Object.entries(data as Record<string, unknown>)) {
      if (Array.isArray(v) && v.length > 0) {
        const first = v[0];
        if (typeof first === "object" && first !== null) {
          const f = first as Record<string, unknown>;
          if ("role" in f || "content" in f || "text" in f || "message" in f) {
            const messages: ConversationMessage[] = [];
            for (const msg of v) {
              if (typeof msg === "object" && msg !== null) {
                const m = msg as Record<string, unknown>;
                const role = (m.role || m.type || "unknown") as string;
                const content = (m.content ||
                  m.text ||
                  m.message ||
                  "") as string;
                if (content) {
                  messages.push({
                    role: String(role),
                    content: String(content),
                  });
                }
              }
            }
            if (messages.length > 0) {
              conversations.push({
                id: key,
                title: `Chat from ${key}`,
                messages,
                messageCount: messages.length,
              });
            }
          }
        }
      }
    }
  }

  return conversations;
}

function extractConversationsFromWorkspace(
  workspaceDir: string
): Conversation[] {
  const dbPath = path.join(workspaceDir, "state.vscdb");
  if (!fs.existsSync(dbPath)) return [];

  const conversations: Conversation[] = [];

  for (const key of CHAT_KEYS) {
    const raw = queryDb(dbPath, key);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        conversations.push(...parseChatData(data));
      } catch {
        // ignore
      }
    }
  }

  const composerRows = queryDbKeysLike(dbPath, "composerData:%");
  for (const [key, value] of composerRows) {
    try {
      const data = JSON.parse(value);
      const convo = parseComposerData(key, data);
      if (convo) conversations.push(convo);
    } catch {
      // ignore
    }
  }

  for (const keyName of ["aiService.prompts", "aiService.generations"]) {
    const raw = queryDb(dbPath, keyName);
    if (raw) {
      try {
        const data = JSON.parse(raw);
        if (Array.isArray(data)) {
          for (const item of data) {
            const convo = parseAiServiceItem(item);
            if (convo) conversations.push(convo);
          }
        }
      } catch {
        // ignore
      }
    }
  }

  if (conversations.length === 0) {
    const allKeys = listAllKeys(dbPath);
    const chatLikeKeys = allKeys.filter((k) => {
      const lower = k.toLowerCase();
      return ["chat", "composer", "conversation", "aichat", "prompt"].some(
        (term) => lower.includes(term)
      );
    });

    for (const key of chatLikeKeys) {
      if (CHAT_KEYS.includes(key)) continue;
      const raw = queryDb(dbPath, key);
      if (raw) {
        try {
          const data = JSON.parse(raw);
          conversations.push(...parseGenericChatData(key, data));
        } catch {
          // ignore
        }
      }
    }
  }

  return conversations;
}

// ---------------------------------------------------------------------------
// Skill generation helpers
// ---------------------------------------------------------------------------

function formatConversationForPrompt(conversation: Conversation): string {
  const lines: string[] = [`# Conversation: ${conversation.title}\n`];

  for (const msg of conversation.messages) {
    const role = msg.role.toUpperCase();
    let content = msg.content;
    if (content.length > 5000) {
      content =
        content.slice(0, 2500) +
        "\n\n[... content trimmed ...]\n\n" +
        content.slice(-2500);
    }
    lines.push(`**${role}:**\n${content}\n`);
  }

  return lines.join("\n---\n");
}

// ---------------------------------------------------------------------------
// Workspace resolution
// ---------------------------------------------------------------------------

function resolveWorkspace(workspace: string): string {
  if (workspace === "latest") {
    const dirs = getWorkspaceDirs();
    if (dirs.length === 0) throw new Error("No workspaces found");
    return dirs[0];
  }

  if (fs.existsSync(workspace) && fs.statSync(workspace).isDirectory()) {
    return workspace;
  }

  const storagePath = getWorkspaceStoragePath();
  const candidate = path.join(storagePath, workspace);
  if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
    return candidate;
  }

  const dirs = getWorkspaceDirs();
  for (const d of dirs) {
    if (path.basename(d).includes(workspace)) return d;
    if (getWorkspaceName(d).toLowerCase().includes(workspace.toLowerCase()))
      return d;
  }

  throw new Error(`Workspace not found: ${workspace}`);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function discoverWorkspaces(filter?: string): WorkspaceInfo[] {
  console.log("[Cursor Skills] Discovering workspaces...");

  const dirs = getWorkspaceDirs();
  const workspaces: WorkspaceInfo[] = [];

  console.log(`[Cursor Skills] Found ${dirs.length} workspace directories`);

  for (const dir of dirs) {
    let conversations = extractConversationsFromWorkspace(dir);

    if (filter) {
      const filterLower = filter.toLowerCase();
      conversations = conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(filterLower) ||
          c.messages
            .slice(0, 5)
            .some((m) => m.content.toLowerCase().includes(filterLower))
      );
    }

    if (filter && conversations.length === 0) continue;

    workspaces.push({
      id: path.basename(dir),
      name: getWorkspaceName(dir),
      path: dir,
      conversationCount: conversations.length,
      conversations: conversations.slice(0, 10).map((c) => ({
        id: c.id,
        title: c.title,
        messageCount: c.messageCount,
        preview:
          c.messages[0]?.content.slice(0, 100).replace(/\n/g, " ") || "",
      })),
    });
  }

  console.log(
    `[Cursor Skills] Returning ${workspaces.length} workspaces with conversations`
  );
  return workspaces;
}

export function exportConversations(workspace: string): ExportResult {
  console.log(
    `[Cursor Skills] Exporting conversations from workspace: ${workspace}`
  );

  const dir = resolveWorkspace(workspace);
  const name = getWorkspaceName(dir);
  const conversations = extractConversationsFromWorkspace(dir);

  console.log(
    `[Cursor Skills] Extracted ${conversations.length} conversations from "${name}"`
  );
  return { name, conversations };
}

export async function generateSkills(
  workspace: string,
  apiKey: string,
  minMessages: number = 4
): Promise<GenerateResult> {
  console.log(
    `[Cursor Skills] Resolving workspace: ${workspace}`
  );

  const dir = resolveWorkspace(workspace);
  const name = getWorkspaceName(dir);

  console.log(
    `[Cursor Skills] Extracting conversations from "${name}"...`
  );

  const conversations = extractConversationsFromWorkspace(dir);
  const substantive = conversations.filter(
    (c) => c.messageCount >= minMessages
  );

  console.log(
    `[Cursor Skills] Found ${conversations.length} total, ${substantive.length} with ${minMessages}+ messages`
  );

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey });

  const skills: GenerateResult["skills"] = [];

  for (let i = 0; i < substantive.length; i++) {
    const convo = substantive[i];
    console.log(
      `[Cursor Skills] Generating skill ${i + 1}/${substantive.length}: "${convo.title.slice(0, 60)}"...`
    );

    try {
      let formatted = formatConversationForPrompt(convo);
      if (formatted.length > 400000) {
        formatted =
          formatted.slice(0, 200000) +
          "\n\n[... conversation truncated ...]\n\n" +
          formatted.slice(-200000);
      }

      const message = await client.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: SKILL_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Here is a conversation from Cursor IDE. Convert it into one or more reusable skill documents:\n\n${formatted}`,
          },
        ],
      });

      const content =
        message.content[0].type === "text" ? message.content[0].text : "";

      skills.push({
        title: convo.title,
        content,
        sourceConversation: convo.id,
      });

      console.log(
        `[Cursor Skills] Successfully generated skill for "${convo.title.slice(0, 60)}"`
      );

      if (i < substantive.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      console.error(
        `[Cursor Skills] Error generating skill for "${convo.title}":`,
        error
      );
      skills.push({
        title: convo.title,
        content: `Error generating skill: ${error instanceof Error ? error.message : String(error)}`,
        sourceConversation: convo.id,
      });
    }
  }

  console.log(
    `[Cursor Skills] Generation complete. Produced ${skills.length} skills.`
  );

  return {
    name,
    totalConversations: conversations.length,
    substantiveConversations: substantive.length,
    skills,
  };
}
