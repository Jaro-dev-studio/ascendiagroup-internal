import { searchWeb } from "@/lib/web-search/search";
import { defineTool, type AITool } from "../types";

export const webReadTools: AITool[] = [
  defineTool({
    name: "searchWeb",
    label: "Search the Web",
    risk: "read",
    description:
      "Search the public internet and get back a short researched answer with the source links. Use this for anything that does not live in our own systems: researching a prospect, client or competitor, market and pricing context, news, public company or people information, technical documentation, library versions, regulations, or checking a claim you are not certain about. Do not use it for our own records — clients, deals, tasks, calls and internal documents come from the other tools. Ask a full question rather than keywords, and search again with a narrower question if the first answer is thin.",
    parameters: {
      properties: {
        query: {
          type: "string",
          description:
            "The question to research, written as a full natural language question with any context needed to disambiguate it",
        },
        depth: {
          type: "string",
          enum: ["quick", "thorough"],
          description:
            "quick (default) for a fact or a single page; thorough reads more sources for comparisons and research summaries, and takes about twice as long",
        },
      },
      required: ["query"],
    },
    execute: async (args) => {
      const { query, depth } = args as { query?: string; depth?: "quick" | "thorough" };

      if (!query?.trim()) return { error: "query is required" };

      const result = await searchWeb({ query: query.trim(), depth });

      if (!result.answer) {
        return {
          query,
          error: "The search returned no usable answer. Try a narrower or differently worded question.",
        };
      }

      return {
        query,
        answer: result.answer,
        sources: result.sources,
        searchedFor: result.queries,
        note: "Cite a source by hyperlinking the words that carry the claim rather than pasting the raw URL. The chat already lists these sources under your reply, so do not repeat them as a list of your own.",
      };
    },
  }),
];
