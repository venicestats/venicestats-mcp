import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { NA, countOf, changeNote, changePct, firstOf, fmtCount, fmtShare, fmtToken, fmtUsd, missingList, num, positive, rows, str, type Maybe } from "../lib/format.js";

interface InsiderKpis {
  // Flows and volumes are US dollars; claimed and held are VVV.
  netFlow30d: number;
  prevNetFlow30d: number;
  sellVolume30d: number;
  buyVolume30d: number;
  sellPressure: string;
  /** Change of the sell volume against the previous 30 days. Null when there is no base. */
  sellTrendPct: number | null;
  sellTrendNote?: string;
  retentionRate: number | null;
  totalClaimed: number;
  totalHeld: number;
  /** VVV claimed by the wallets with a known balance: the base of retentionRate. */
  retentionClaimed?: number;
  walletsWithoutBalance?: number;
  activeTraders30d: number;
  activeTraders7d: number;
  totalTrades30d: number;
}

interface Recipient {
  address: string;
  name: string | null;
  claimed: number;
  /** US dollars. */
  sellVolume: number;
  buyVolume: number;
  /** VVV. Null when an amount was not read. */
  soldVvv?: number | null;
  boughtVvv?: number | null;
  retention: number | null;
  behavior: string;
}

interface OverviewResponse {
  kpis: InsiderKpis;
}

interface RecipientsResponse {
  recipients: Recipient[];
}

function sellTrend(k: NonNullable<Maybe<InsiderKpis>>): string {
  const note = str(k.sellTrendNote);
  if (note !== null) return note;
  const pct = num(k.sellTrendPct);
  // Without the note, a 0 also stands for "no sales in the previous 30 days to compare with".
  return pct === null || pct === 0 ? "change vs prev 30d n/a" : `${pct > 0 ? "+" : ""}${pct}% sell volume vs prev 30d`;
}

/** "$116.5K" or, when the VVV is known too, "9.5K VVV ($116.5K)". */
function traded(vvv: unknown, usd: unknown): string {
  return num(vvv) === null ? fmtUsd(usd) : `${fmtToken(vvv, "VVV")} (${fmtUsd(usd)})`;
}

export function registerInsiderFlowTool(server: McpServer) {
  server.tool(
    "venicestats_insider_flow",
    "Returns insider (vesting recipient) trading data from VeniceStats.com — net flow and volumes in USD, sell pressure, retention rate, per-wallet breakdown. Use when someone asks about insider selling or vesting activity. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      mode: z.enum(["overview", "recipients"]).default("overview").describe("'overview' for KPIs and trends, 'recipients' for per-wallet breakdown"),
      limit: z.number().int().min(1).max(50).default(10).describe("Number of recipients to return (recipients mode only, default 10)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ mode, limit }) => {
      try {
        if (mode === "overview") {
          const d = await apiGet<OverviewResponse>("/api/insider-flow", { mode: "overview" });
          const k = d.kpis ?? {};

          const net = num(k.netFlow30d);
          const flowDir = net === null ? "" : net < 0 ? " net selling" : net > 0 ? " net buying" : " flat";
          const without = num(k.walletsWithoutBalance);
          // No wallet with a known balance: the API's held figure is then an empty sum.
          const base = positive(k.retentionClaimed);
          const held = k.retentionClaimed === undefined || base !== null ? k.totalHeld : null;

          const lines = [
            `## Insider Flow — VeniceStats (30d)`,
            `Net Flow: ${fmtUsd(net)}${flowDir}${changeNote(changePct(k.netFlow30d, k.prevNetFlow30d), "vs prev 30d")}`,
            `Sell Volume: ${fmtUsd(k.sellVolume30d)} | Buy Volume: ${fmtUsd(k.buyVolume30d)}`,
            `Sell Pressure: **${str(k.sellPressure) ?? NA}** (${sellTrend(k)})`,
            "",
            `## Retention`,
            `Total Claimed: ${fmtToken(k.totalClaimed, "VVV")} | Currently Held: ${fmtToken(held, "VVV")}`,
            `Retention Rate: ${fmtShare(k.retentionRate)}${base !== null && num(k.retentionRate) !== null ? ` of ${fmtToken(base, "VVV")} claimed by wallets with a known balance` : ""}`,
            ...(without !== null && without > 0 ? [`Wallets without a balance read (left out of the rate): ${without}`] : []),
            "",
            `## Activity`,
            `Active Traders: ${fmtCount(k.activeTraders7d)} (7d) / ${fmtCount(k.activeTraders30d)} (30d)`,
            `Total Trades (30d): ${fmtCount(k.totalTrades30d)}`,
            "",
            deepLinkLine("/vesting"),
          ];

          return brandedResponse(lines.join("\n"), {
            deepLink: "/vesting",
            tip: "Use venicestats_insider_flow with mode='recipients' for per-wallet breakdown, or venicestats_vesting for unlock schedules.",
          });
        } else {
          const d = await apiGet<RecipientsResponse>("/api/insider-flow", { mode: "recipients" });
          const top = rows(d.recipients).slice(0, limit);

          const lines = [
            `## Top ${countOf(d.recipients) === null ? NA : top.length} Insider Recipients (VeniceStats)`,
            "",
            ...missingList(d.recipients),
          ];

          for (const r of top) {
            const name = firstOf([r.name, r.address], "unknown wallet");
            lines.push(`- **${name}** — ${firstOf([r.behavior], "behavior n/a")} | Claimed: ${fmtToken(r.claimed, "VVV")} | Sold: ${traded(r.soldVvv, r.sellVolume)} | Bought: ${traded(r.boughtVvv, r.buyVolume)} | Retention: ${fmtShare(r.retention)}`);
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
