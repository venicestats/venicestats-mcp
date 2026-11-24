import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { countOf, firstOf, fmtCount, fmtToken, missingList, num, rows, sharePct } from "../lib/format.js";

interface Holder {
  rank: number;
  address: string;
  username: string | null;
  ensName: string | null;
  svvvBalance: number;
  svvvLocked: number;
  diemStaked: number;
  convictionScore: number;
}

interface HoldersResponse {
  holders: Holder[];
  totalHolders: number;
}

export function registerLeaderboardTool(server: McpServer) {
  server.tool(
    "venicestats_leaderboard",
    "Returns top VVV holders from VeniceStats.com — ranked by sVVV, DIEM, conviction, or locked. Use when someone asks about biggest holders or leaderboard. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      sort: z.enum(["svvv", "diem", "conviction", "locked"]).default("svvv").describe("Sort by: svvv (staked balance), diem (DIEM staked), conviction (conviction score), locked (locked sVVV)"),
      limit: z.number().int().min(1).max(25).default(10).describe("Number of holders to return (1-25, default 10)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ sort, limit }) => {
      try {
        const d = await apiGet<HoldersResponse>("/api/holders", { sort, limit });
        const holders = rows(d.holders);

        const sortLabel = { svvv: "sVVV Balance", diem: "DIEM Staked", conviction: "Conviction Score", locked: "Locked sVVV" }[sort];

        const lines = [
          `## Venice Leaderboard (VeniceStats) — Top ${fmtCount(countOf(d.holders))} by ${sortLabel}`,
          `(${fmtCount(d.totalHolders)} total holders)`,
          "",
          ...missingList(d.holders),
        ];

        holders.forEach((h, i) => {
          const name = firstOf([h.ensName, h.username, h.address], "unknown wallet");
          const lockPct = sharePct(h.svvvLocked, h.svvvBalance);
          const locked = lockPct === null ? "" : ` (${Math.round(lockPct)}% locked)`;
          lines.push(
            `${num(h.rank) ?? i + 1}. **${name}** — ${fmtToken(h.svvvBalance, "sVVV")}${locked} | DIEM: ${fmtToken(h.diemStaked)} staked | Conviction: ${fmtCount(h.convictionScore)}`,
          );
        });

        lines.push("", deepLinkLine("/venetians"));

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
