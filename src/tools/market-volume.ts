import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { NA, changeNote, changePct, firstOf, fmtCount, fmtShare, fmtUsd, missingList, num, positive, rows } from "../lib/format.js";

interface Pool {
  pool: string;
  name: string;
  dex: string;
  volume: number;
  volumePct: number;
  swaps: number;
  buyPct: number | null;
}

interface MarketsResponse {
  kpis: {
    volume: number | null;
    volumePrev: number;
    buyPct: number | null;
    /** Null for periods above 30 days: unique wallets are not counted there. */
    traders: number | null;
    tradersPrev: number | null;
    swaps: number | null;
  };
  pools: Pool[];
}

/**
 * Unique wallets are not counted for these: the API sends null, or on older versions a sum
 * of daily counts per pool, which counts the same wallet many times.
 */
const LONG_PERIODS = new Set(["90d", "1y", "all"]);

export function registerMarketVolumeTool(server: McpServer) {
  server.tool(
    "venicestats_market_volume",
    "Returns DEX trading volume from VeniceStats.com — volume by pool, buy/sell ratio, and unique traders (periods up to 30 days). Use when someone asks about trading activity or volume. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      token: z.enum(["VVV", "DIEM"]).default("VVV").describe("Token to view market data for"),
      period: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).default("24h").describe("Lookback period"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ token, period }) => {
      try {
        const d = await apiGet<MarketsResponse>("/api/markets", { token, period });
        const k = d.kpis;

        const buyPct = num(k?.buyPct);
        const traders = LONG_PERIODS.has(period)
          ? `${NA} (unique wallets are only counted up to 30 days)`
          : `${fmtCount(k?.traders)}${changeNote(changePct(k?.traders, k?.tradersPrev), "vs prev period")}`;

        const lines = [
          `## ${token} Market — VeniceStats (${period})`,
          `Volume: ${fmtUsd(k?.volume)}${changeNote(changePct(k?.volume, k?.volumePrev), "vs prev period")}`,
          `Buy/Sell: ${buyPct === null ? NA : `${buyPct}% buy / ${100 - buyPct}% sell`}`,
          `Traders: ${traders} | Swaps: ${fmtCount(k?.swaps)}`,
          "",
          `## Pool Breakdown`,
          ...missingList(d.pools),
          ...rows(d.pools)
            .filter((p) => positive(p.volume) !== null)
            .map((p) => `- **${firstOf([p.name, p.pool], "unnamed pool")}** (${firstOf([p.dex], "unknown DEX")}): ${fmtUsd(p.volume)} (${fmtShare(p.volumePct)}) — ${fmtCount(p.swaps)} swaps, ${fmtShare(p.buyPct)} buy`),
          "",
          deepLinkLine(`/markets?token=${token}&period=${period}`),
        ];

        return brandedResponse(lines.join("\n"), {
          deepLink: `/markets?token=${token}&period=${period}`,
          tip: "Use venicestats_large_trades for individual large trades, or venicestats_insider_flow for vesting recipient activity.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
