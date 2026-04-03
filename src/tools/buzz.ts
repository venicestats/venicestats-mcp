import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
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
    "Returns recent articles, tweets, and videos about Venice.ai from VeniceStats.com — curated news feed with optional author filter. Use when someone asks about Venice news or community discussion. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      type: z.enum(["article", "video", "tweet"]).optional().describe("Filter by content type"),
      author: z.string().optional().describe("Filter by author handle (e.g. 'gekko_eth', 'AskVenice')"),
      limit: z.number().int().min(1).max(20).default(10).describe("Number of items to return (1-20, default 10)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ type, author, limit }) => {
      try {
        const params: Record<string, string | number> = { limit };
        if (type) params.type = type;
        if (author) params.author = author;

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

        lines.push(deepLinkLine("/buzz"));

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
