import "server-only";

import { getIntegrationCredentials } from "./store";

const BASE_URL = "https://api.trello.com/1";

async function trelloRequest<T>(
  path: string,
  options: { method?: string; params?: Record<string, string> } = {}
): Promise<T> {
  const credentials = await getIntegrationCredentials("TRELLO");
  if (!credentials?.apiKey || !credentials?.token) {
    throw new Error("Trello is not connected");
  }

  const url = new URL(`${BASE_URL}${path}`);
  url.searchParams.set("key", credentials.apiKey);
  url.searchParams.set("token", credentials.token);
  Object.entries(options.params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  const response = await fetch(url, { method: options.method ?? "GET" });
  if (!response.ok) {
    throw new Error(`Trello API error (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as T;
}

export interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

export async function createTrelloBoard(name: string): Promise<TrelloBoard> {
  console.log(`[Trello] creating board "${name}"...`);

  const board = await trelloRequest<TrelloBoard>("/boards/", {
    method: "POST",
    params: { name, defaultLists: "false" },
  });

  for (const listName of ["Onboarding", "In progress", "Review", "Done"]) {
    await trelloRequest("/lists", {
      method: "POST",
      params: { name: listName, idBoard: board.id, pos: "bottom" },
    });
  }

  console.log(`[Trello] board created: ${board.url}`);
  return board;
}

export async function getFirstListId(boardId: string): Promise<string | null> {
  const lists = await trelloRequest<{ id: string }[]>(`/boards/${boardId}/lists`);
  return lists[0]?.id ?? null;
}

export async function createTrelloCard(input: {
  listId: string;
  name: string;
  description?: string;
  dueDate?: Date | null;
}): Promise<{ id: string; url: string }> {
  return trelloRequest<{ id: string; url: string }>("/cards", {
    method: "POST",
    params: {
      idList: input.listId,
      name: input.name,
      ...(input.description ? { desc: input.description } : {}),
      ...(input.dueDate ? { due: input.dueDate.toISOString() } : {}),
    },
  });
}
