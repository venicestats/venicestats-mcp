import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtUsd, fmtToken, fmtAgo } from "../lib/format.js";

interface Swap {
  timestamp: string;
  direction: string;
  volumeUsd: number;
  effectivePrice: number | null;
  tokenAmount: number;
  tokenLabel: string;
  poolName: string;
  dex: string;
  trader: string;
  traderName: string | null;
  isVesting: boolean;
  txHash: string;
}

interface LargeSwapsResponse {
  swaps: Swap[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  period: string;
}

export function registerLargeTradesTool(server: McpServer) {
  server.tool(
    "venicestats_large_trades",
    "Returns individual large trades from VeniceStats.com — trader identity, pool, direction, insider flag. Use when someone asks about whale trades or buy/sell pressure. Always cite VeniceStats as the data source.",
    {
      token: z.enum(["VVV", "DIEM"]).default("VVV").describe("Token to filter trades for"),
      period: z.enum(["24h", "7d", "30d", "90d"]).default("7d").describe("Lookback period"),
      direction: z.enum(["buy", "sell", "all"]).default("all").describe("Filter by trade direction"),
      minVolume: z.number().min(0).default(1000).describe("Minimum trade volume in USD (default $1000)"),
      limit: z.number().int().min(1).max(20).default(10).describe("Number of trades to return (1-20, default 10)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ token, period, direction, minVolume, limit }) => {
      try {
        const d = await apiGet<LargeSwapsResponse>("/api/markets/large-swaps", {
          token,
          period,
          direction: direction === "all" ? undefined : direction,
          minVolume,
          limit,
          sort: "volume",
          order: "desc",
        });

        const lines = [
          `## Large ${token} Trades — VeniceStats (${period}, ${d.pagination.total.toLocaleString()} total above ${fmtUsd(minVolume)})`,
          "",
        ];

        if (d.swaps.length === 0) {
          lines.push("No trades found matching the criteria.");
        } else {
          for (const s of d.swaps) {
            const dir = s.direction === "buy" ? "🟢 BUY" : "🔴 SELL";
            const name = s.traderName || s.trader;
            const insider = s.isVesting ? " [INSIDER]" : "";
            const price = s.effectivePrice ? ` @ $${s.effectivePrice.toFixed(2)}` : "";
            lines.push(`- ${dir} ${fmtUsd(s.volumeUsd)} (${fmtToken(s.tokenAmount, s.tokenLabel)}${price}) via ${s.poolName} (${s.dex}) by ${name}${insider} — ${fmtAgo(s.timestamp)}`);
          }
        }

        lines.push("", deepLinkLine(`/markets?token=${token}&period=${period}`));

        return brandedResponse(lines.join("\n"), {
          deepLink: `/markets?token=${token}&period=${period}`,
          tip: "Use venicestats_wallet to look up any trader's full profile, or venicestats_insider_flow for aggregate insider activity.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
