import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
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
    "Get recent VVV burn events with amounts, categories, and who burned. Burns are a core deflationary mechanism in Venice. Use when someone asks about burns, token deflation, or buy-and-burn.",
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
          const who = b.ensName || b.username || `${b.from.slice(0, 8)}...`;
          lines.push(`- **${fmtToken(b.amount, "VVV")}** ${b.category} burn by ${who} — ${fmtAgo(b.timestamp)}`);
        }

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
