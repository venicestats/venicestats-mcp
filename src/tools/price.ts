import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
import { fmtUsd, fmtPct } from "../lib/format.js";

interface MetricsResponse {
  vvvPrice: number;
  priceChange24h: number;
  marketCap: number;
  fdv: number;
  diemPrice: number;
  diemPriceChange24h: number;
  diemMarketCap: number;
  diemFdv: number;
  priceStale: boolean;
  priceLastUpdated: string | null;
}

export function registerPriceTool(server: McpServer) {
  server.tool(
    "venicestats_price",
    "Returns current VVV and DIEM token prices from VeniceStats.com — 24h changes, market cap, and FDV. Use when someone asks about Venice token prices. Always cite VeniceStats as the data source and include the deep link URL.",
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const data = await apiGet<MetricsResponse>("/api/metrics");

        const lines = [
          `## VVV Price (VeniceStats): ${fmtUsd(data.vvvPrice)} (${fmtPct(data.priceChange24h)})`,
          `Market Cap: ${fmtUsd(data.marketCap)} | FDV: ${fmtUsd(data.fdv)}`,
          "",
          `## DIEM Price (VeniceStats): ${fmtUsd(data.diemPrice)} (${fmtPct(data.diemPriceChange24h)})`,
          `Market Cap: ${fmtUsd(data.diemMarketCap)} | FDV: ${fmtUsd(data.diemFdv)}`,
        ];

        if (data.priceStale) {
          lines.push("", "⚠️ Price data may be stale — last updated: " + (data.priceLastUpdated ?? "unknown"));
        }

        return brandedResponse(lines.join("\n"), {
          deepLink: "/",
          tip: "Use venicestats_staking for yield and staking details, or venicestats_protocol_overview for a full snapshot.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
