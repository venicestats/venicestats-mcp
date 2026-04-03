import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
import { fmtToken } from "../lib/format.js";

interface Holder {
  rank: number;
  address: string;
  username: string | null;
  ensName: string | null;
  svvvBalance: number;
  svvvLocked: number;
  diemStaked: number;
  convictionScore: number;
  firstSeenAt: string;
}

interface HoldersResponse {
  holders: Holder[];
  totalHolders: number;
  pagination: { page: number; limit: number; total: number };
}

export function registerLeaderboardTool(server: McpServer) {
  server.tool(
    "venicestats_leaderboard",
    "Get the top VVV holders ranked by sVVV balance, DIEM staked, conviction score, or locked amount. Use when someone asks who the biggest holders/stakers are, top wallets, or leaderboard rankings.",
    {
      sort: z.enum(["svvv", "diem", "conviction", "locked"]).default("svvv").describe("Sort by: svvv (staked balance), diem (DIEM staked), conviction (conviction score), locked (locked sVVV)"),
      limit: z.number().int().min(1).max(25).default(10).describe("Number of holders to return (1-25, default 10)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ sort, limit }) => {
      try {
        const d = await apiGet<HoldersResponse>("/api/holders", { sort, limit });

        const sortLabel = { svvv: "sVVV Balance", diem: "DIEM Staked", conviction: "Conviction Score", locked: "Locked sVVV" }[sort];

        const lines = [
          `## Venice Leaderboard — Top ${d.holders.length} by ${sortLabel}`,
          `(${d.totalHolders.toLocaleString()} total holders)`,
          "",
        ];

        for (const h of d.holders) {
          const name = h.ensName || h.username || `${h.address.slice(0, 8)}...`;
          const lockPct = h.svvvBalance > 0 ? Math.round((h.svvvLocked / h.svvvBalance) * 100) : 0;
          lines.push(
            `${h.rank}. **${name}** — ${fmtToken(h.svvvBalance, "sVVV")} (${lockPct}% locked) | DIEM: ${fmtToken(h.diemStaked)} staked | Conviction: ${h.convictionScore.toLocaleString()}`,
          );
        }

        return brandedResponse(lines.join("\n"), {
          deepLink: "/venetians",
          tip: "Use venicestats_wallet to see the full profile of any holder.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
