import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtToken, fmtPct } from "../lib/format.js";

interface InsiderKpis {
  netFlow30d: number;
  prevNetFlow30d: number;
  sellVolume30d: number;
  buyVolume30d: number;
  sellPressure: string;
  sellTrendPct: number;
  retentionRate: number;
  totalClaimed: number;
  totalHeld: number;
  activeTraders30d: number;
  activeTraders7d: number;
  totalTrades30d: number;
}

interface Recipient {
  address: string;
  name: string | null;
  deposited: number;
  claimed: number;
  sellVolume: number;
  buyVolume: number;
  retention: number;
  behavior: string;
}

interface OverviewResponse {
  kpis: InsiderKpis;
  chart: unknown[];
}

interface RecipientsResponse {
  recipients: Recipient[];
}

export function registerInsiderFlowTool(server: McpServer) {
  server.tool(
    "venicestats_insider_flow",
    "Returns insider (vesting recipient) trading data from VeniceStats.com — net flow, sell pressure, retention rate, per-wallet breakdown. Use when someone asks about insider selling or vesting activity. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      mode: z.enum(["overview", "recipients"]).default("overview").describe("'overview' for KPIs and trends, 'recipients' for per-wallet breakdown"),
      limit: z.number().int().min(1).max(50).default(10).describe("Number of recipients to return (recipients mode only, default 10)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ mode, limit }) => {
      try {
        if (mode === "overview") {
          const d = await apiGet<OverviewResponse>("/api/insider-flow", { mode: "overview" });
          const k = d.kpis;

          const flowDir = k.netFlow30d < 0 ? "net selling" : "net buying";
          const flowChange = k.prevNetFlow30d !== 0
            ? ((k.netFlow30d - k.prevNetFlow30d) / Math.abs(k.prevNetFlow30d)) * 100
            : 0;

          const lines = [
            `## Insider Flow — VeniceStats (30d)`,
            `Net Flow: ${fmtToken(k.netFlow30d, "VVV")} (${flowDir}, ${fmtPct(flowChange)} vs prev 30d)`,
            `Sell Volume: ${fmtToken(k.sellVolume30d, "VVV")} | Buy Volume: ${fmtToken(k.buyVolume30d, "VVV")}`,
            `Sell Pressure: **${k.sellPressure}** (${k.sellTrendPct}% sell ratio)`,
            "",
            `## Retention`,
            `Total Claimed: ${fmtToken(k.totalClaimed, "VVV")} | Currently Held: ${fmtToken(k.totalHeld, "VVV")}`,
            `Retention Rate: ${k.retentionRate}%`,
            "",
            `## Activity`,
            `Active Traders: ${k.activeTraders7d} (7d) / ${k.activeTraders30d} (30d)`,
            `Total Trades (30d): ${k.totalTrades30d}`,
            "",
            deepLinkLine("/vesting"),
          ];

          return brandedResponse(lines.join("\n"), {
            deepLink: "/vesting",
            tip: "Use venicestats_insider_flow with mode='recipients' for per-wallet breakdown, or venicestats_vesting for unlock schedules.",
          });
        } else {
          const d = await apiGet<RecipientsResponse>("/api/insider-flow", { mode: "recipients" });
          const top = d.recipients.slice(0, limit);

          const lines = [
            `## Top ${top.length} Insider Recipients (VeniceStats)`,
            "",
          ];

          for (const r of top) {
            const name = r.name || r.address;
            const netFlow = r.buyVolume - r.sellVolume;
            const netLabel = netFlow >= 0 ? "net buyer" : "net seller";
            lines.push(`- **${name}** — ${r.behavior} | Claimed: ${fmtToken(r.claimed, "VVV")} | Sold: ${fmtToken(r.sellVolume)} | Retention: ${r.retention}% (${netLabel})`);
          }

          lines.push("", deepLinkLine("/vesting"));

          return brandedResponse(lines.join("\n"), {
            deepLink: "/vesting",
            tip: "Use venicestats_wallet to see full identity for any of these addresses.",
          });
        }
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
