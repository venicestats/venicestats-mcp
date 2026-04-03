import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
import { fmtUsd, fmtPct } from "../lib/format.js";

interface Pool {
  pool: string;
  name: string;
  dex: string;
  volume: number;
  volumePct: number;
  swaps: number;
  buyPct: number;
}

interface MarketsResponse {
  kpis: {
    price: number;
    priceChange: number;
    volume: number;
    volumePrev: number;
    buyPct: number;
    traders: number;
    tradersPrev: number;
    swaps: number;
    swapsPrev: number;
  };
  pools: Pool[];
  token: string;
  period: string;
}

export function registerMarketVolumeTool(server: McpServer) {
  server.tool(
    "venicestats_market_volume",
    "Get DEX trading volume for VVV or DIEM: total volume, buy/sell ratio, trader count, and breakdown by pool (Aerodrome, Uniswap, RFQ). Use when someone asks about trading activity, volume, or market dynamics.",
    {
      token: z.enum(["VVV", "DIEM"]).default("VVV").describe("Token to view market data for"),
      period: z.enum(["24h", "7d", "30d", "90d", "1y", "all"]).default("24h").describe("Lookback period"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ token, period }) => {
      try {
        const d = await apiGet<MarketsResponse>("/api/markets", { token, period });

        const volChange = d.kpis.volumePrev > 0
          ? ((d.kpis.volume - d.kpis.volumePrev) / d.kpis.volumePrev) * 100
          : 0;
        const traderChange = d.kpis.tradersPrev > 0
          ? ((d.kpis.traders - d.kpis.tradersPrev) / d.kpis.tradersPrev) * 100
          : 0;

        const lines = [
          `## ${token} Market — ${period}`,
          `Volume: ${fmtUsd(d.kpis.volume)} (${fmtPct(volChange)} vs prev period)`,
          `Buy/Sell: ${d.kpis.buyPct}% buy / ${100 - d.kpis.buyPct}% sell`,
          `Traders: ${d.kpis.traders.toLocaleString()} (${fmtPct(traderChange)}) | Swaps: ${d.kpis.swaps.toLocaleString()}`,
          "",
          `## Pool Breakdown`,
          ...d.pools
            .filter((p) => p.volume > 0)
            .map((p) => `- **${p.name}** (${p.dex}): ${fmtUsd(p.volume)} (${p.volumePct}%) — ${p.swaps} swaps, ${p.buyPct}% buy`),
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
