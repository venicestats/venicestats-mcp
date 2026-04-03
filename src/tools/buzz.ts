import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
import { fmtAgo } from "../lib/format.js";

interface BuzzItem {
  type: string;
  title: string;
  url: string;
  summary: string | null;
  authorName: string | null;
  authorHandle: string | null;
  sourceName: string | null;
  likeCount: number | null;
  retweetCount: number | null;
  publishedAt: string;
}

interface BuzzResponse {
  items: BuzzItem[];
  total: number;
}

export function registerBuzzTool(server: McpServer) {
  server.tool(
    "venicestats_buzz",
    "Get recent articles, tweets, and videos about Venice.ai. A curated news feed of community content. Use when someone asks about Venice news, what people are saying, recent articles, or community discussion.",
    {
      type: z.enum(["article", "video", "tweet"]).optional().describe("Filter by content type"),
      limit: z.number().int().min(1).max(20).default(10).describe("Number of items to return (1-20, default 10)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ type, limit }) => {
      try {
        const params: Record<string, string | number> = { limit };
        if (type) params.type = type;

        const d = await apiGet<BuzzResponse>("/api/buzz", params);

        const typeLabel = type || "all";
        const lines = [
          `## Venice Buzz — ${typeLabel} (${d.total} total)`,
          "",
        ];

        for (const item of d.items) {
          const source = item.sourceName || item.authorHandle || "Unknown";
          const engagement = [
            item.likeCount ? `${item.likeCount} likes` : null,
            item.retweetCount ? `${item.retweetCount} RTs` : null,
          ].filter(Boolean).join(", ");

          lines.push(`### ${item.title}`);
          lines.push(`${item.type} by ${source} — ${fmtAgo(item.publishedAt)}${engagement ? ` (${engagement})` : ""}`);
          if (item.summary) lines.push(item.summary);
          lines.push(`[Read more](${item.url})`, "");
        }

        return brandedResponse(lines.join("\n"), {
          deepLink: "/buzz",
          tip: "Use venicestats_social for quantitative sentiment metrics (Twitter followers, CoinGecko sentiment).",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
