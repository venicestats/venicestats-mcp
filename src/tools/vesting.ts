import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
import { fmtToken, fmtRatio, fmtDate } from "../lib/format.js";

interface VestingResponse {
  totalLocked: number;
  totalDeposited: number;
  totalWithdrawn: number;
  dailyDripRate: number;
  activeStreams: number;
  totalStreams: number;
  uniqueRecipients: number;
  pctLocked: number;
  pctClaimed: number;
  fullyVestedBy: string;
  dripCliff: { date: string; dropPct: number; streamCount: number } | null;
  lastUpdated: string;
}

export function registerVestingTool(server: McpServer) {
  server.tool(
    "venicestats_vesting",
    "Get vesting schedule overview: total locked VVV, daily drip rate, active streams, fully vested date, and next cliff. Vesting streams are Sablier linear unlocks for team/investors. Use when someone asks about vesting, token unlocks, sell pressure from vesting, or how much VVV is still locked.",
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const d = await apiGet<VestingResponse>("/api/vesting", { mode: "overview" });

        const lines = [
          `## Vesting Overview`,
          `Total Locked: ${fmtToken(d.totalLocked, "VVV")} (${d.pctLocked}% of deposited)`,
          `Total Deposited: ${fmtToken(d.totalDeposited, "VVV")} | Withdrawn: ${fmtToken(d.totalWithdrawn, "VVV")} (${d.pctClaimed}%)`,
          `Daily Drip: ${fmtToken(d.dailyDripRate, "VVV")}/day`,
          "",
          `## Streams`,
          `Active: ${d.activeStreams} of ${d.totalStreams} total | ${d.uniqueRecipients} unique recipients`,
          `Fully Vested By: ${fmtDate(d.fullyVestedBy)}`,
        ];

        if (d.dripCliff) {
          lines.push(
            "",
            `## Next Cliff`,
            `Date: ${fmtDate(d.dripCliff.date)}`,
            `Impact: ${d.dripCliff.dropPct}% drop in daily drip (${d.dripCliff.streamCount} streams end)`,
          );
        }

        return brandedResponse(lines.join("\n"), {
          deepLink: "/vesting",
          tip: "Use venicestats_insider_flow to see what vesting recipients are doing with their tokens (buying vs selling).",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
