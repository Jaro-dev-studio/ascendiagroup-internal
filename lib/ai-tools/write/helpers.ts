import prisma from "@/lib/prisma";
import { lookupEntityLabel } from "../preview";
import type { ToolArgs, ToolPreview } from "../types";

interface ActionResult<T> {
  data: T | null;
  error: string | null;
}

/** Server actions return { data, error }; tools throw so the registry can report failure. */
export async function unwrapAction<T>(promise: Promise<ActionResult<T>>): Promise<T> {
  const result = await promise;
  if (result.error) throw new Error(result.error);
  return result.data as T;
}

export function toDate(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/** Strips undefined keys so partial updates only touch the fields the model supplied. */
export function definedOnly<T extends Record<string, unknown>>(input: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined)
  ) as Partial<T>;
}

export function changeSummary(args: ToolArgs, skipKeys: string[] = []): string {
  const entries = Object.entries(args).filter(
    ([key, value]) => !skipKeys.includes(key) && value !== undefined && value !== null
  );

  if (entries.length === 0) return "No field changes.";

  return entries
    .map(([key, value]) => {
      const label = key.replace(/([A-Z])/g, " $1").toLowerCase();
      const text = Array.isArray(value) ? value.join(", ") : String(value);
      return `${label.trim()}: ${text.length > 80 ? `${text.slice(0, 77)}...` : text}`;
    })
    .join(" · ");
}

type DeletePreviewKind = Parameters<typeof lookupEntityLabel>[0];

/** Standard preview for a delete: resolves the record name so the card is readable. */
export function deletePreview(
  kind: DeletePreviewKind,
  idKey: string,
  noun: string
): (args: ToolArgs) => Promise<ToolPreview> {
  return async (args) => {
    const id = String(args[idKey] ?? "");
    const label = id ? await lookupEntityLabel(kind, id) : null;

    return {
      title: `Delete ${noun}`,
      summary: label
        ? `"${label}" will be permanently deleted. This cannot be undone.`
        : `${noun} ${id} will be permanently deleted. This cannot be undone.`,
      details: { id },
    };
  };
}

export async function clientNameFor(clientCompanyId?: unknown): Promise<string | null> {
  if (typeof clientCompanyId !== "string" || !clientCompanyId) return null;
  const company = await prisma.company.findUnique({
    where: { id: clientCompanyId },
    select: { name: true },
  });
  return company?.name ?? null;
}
