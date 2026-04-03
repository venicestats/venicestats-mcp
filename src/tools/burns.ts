import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtToken, fmtAgo } from "../lib/format.js";

interface Burn {
  id: number;
  txHash: string;
  timestamp: string;
  from: string;
  username: string | null;
  ensName: string | null;
  amount: number;
  category: string;
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
          `## VVV Burns (${d.total.toLocaleString()} total)`,
          `Showing ${d.burns.length} most recent${category ? ` (${category} only)` : ""}:`,
          "",
        ];

        for (const b of d.burns) {
          const who = b.ensName || b.username || b.from;
          lines.push(`- **${fmtToken(b.amount, "VVV")}** ${b.category} burn by ${who} — ${fmtAgo(b.timestamp)}`);
        }

        lines.push("", deepLinkLine("/burns"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/burns",
          tip: "Use venicestats_protocol_overview for burn revenue and deflation rate metrics.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
