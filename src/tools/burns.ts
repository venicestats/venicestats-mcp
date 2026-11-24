import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { countOf, firstOf, fmtAgo, fmtCount, fmtToken, missingList, rows } from "../lib/format.js";

interface Burn {
  timestamp: string;
  from: string;
  username: string | null;
  ensName: string | null;
  amount: number;
  category: string;
  /** Finer than `category`: tells subscriptions and credits apart. Null or absent = not known. */
  channel?: string | null;
}

interface BurnsResponse {
  burns: Burn[];
  total: number;
}

export function registerBurnsTool(server: McpServer) {
  server.tool(
    "venicestats_burns",
    "Returns recent VVV burn events from VeniceStats.com — amounts, categories, burner addresses. Use when someone asks about burns or deflation. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      limit: z.number().int().min(1).max(50).default(10).describe("Number of burn events to return (1-50, default 10)"),
      category: z.enum(["organic", "team", "airdrop", "micro"]).optional().describe("Filter by burn category"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ limit, category }) => {
      try {
        const params: Record<string, string | number> = { limit };
        if (category) params.category = category;

        const d = await apiGet<BurnsResponse>("/api/burns", params);

        const lines = [
          `## VVV Burns (${fmtCount(d.total)} total)`,
          `Showing ${fmtCount(countOf(d.burns))} most recent${category ? ` (${category} only)` : ""}:`,
          "",
          ...missingList(d.burns),
        ];

        for (const b of rows(d.burns)) {
          const who = firstOf([b.ensName, b.username, b.from], "unknown wallet");
          lines.push(`- **${fmtToken(b.amount, "VVV")}** ${firstOf([b.channel, b.category], "uncategorized")} burn by ${who} — ${fmtAgo(b.timestamp)}`);
        }

        lines.push("", deepLinkLine("/burns"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/burns",
          tip: "Use venicestats_protocol_overview with category='burns' for the burn run-rate and deflation.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
