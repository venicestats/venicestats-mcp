import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { firstOf, fmtCount, fmtToken, fmtUsd, missingList, rows } from "../lib/format.js";

interface CategoryBreakdown {
  category: string;
  vvv: number;
  svvv: number;
  valueUsd: number;
}

interface TreasuryResponse {
  totalVvv: number;
  totalSvvv: number;
  totalDiem: number;
  totalValueUsd: number;
  walletsTracked: number;
  categoryBreakdown: CategoryBreakdown[];
}

export function registerTreasuryTool(server: McpServer) {
  server.tool(
    "venicestats_treasury",
    "Returns Venice treasury balances from VeniceStats.com — VVV, sVVV, DIEM by category. Use when someone asks about treasury holdings. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const d = await apiGet<TreasuryResponse>("/api/treasury", { mode: "overview" });

        const lines = [
          `## Venice Treasury (VeniceStats) — ${fmtUsd(d.totalValueUsd)}`,
          `VVV: ${fmtToken(d.totalVvv)} | sVVV: ${fmtToken(d.totalSvvv)} | DIEM: ${fmtToken(d.totalDiem)}`,
          `Wallets tracked: ${fmtCount(d.walletsTracked)}`,
          "",
          `## Breakdown by Category`,
          ...missingList(d.categoryBreakdown),
        ];

        for (const c of rows(d.categoryBreakdown)) {
          // Empty categories are left out; one with an unknown value is not empty.
          if (c.valueUsd === 0) continue;
          lines.push(`- **${firstOf([c.category], "uncategorized")}**: ${fmtUsd(c.valueUsd)} (${fmtToken(c.vvv, "VVV")}, ${fmtToken(c.svvv, "sVVV")})`);
        }

        lines.push("", deepLinkLine("/treasury"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/treasury",
          tip: "Use venicestats_vesting for unlock schedules, or venicestats_protocol_overview for full protocol economics.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
