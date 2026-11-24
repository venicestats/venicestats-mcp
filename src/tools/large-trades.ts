import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { firstOf, fmtAgo, fmtCount, fmtPrice, fmtToken, fmtUsd, missingList, positive, rows, str } from "../lib/format.js";

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
}

interface LargeSwapsResponse {
  swaps: Swap[];
  pagination: {
    total: number;
  };
}

/** Side of a trade; an unknown one is never shown as a sell. */
export function tradeSide(direction: unknown): string {
  return direction === "buy" ? "🟢 BUY" : direction === "sell" ? "🔴 SELL" : "⚪ TRADE";
}

export function registerLargeTradesTool(server: McpServer) {
  server.tool(
    "venicestats_large_trades",
    "Returns individual large trades from VeniceStats.com — trader identity, pool, direction, insider flag. Use when someone asks about whale trades or buy/sell pressure. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
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
          `## Large ${token} Trades — VeniceStats (${period}, ${fmtCount(d.pagination?.total)} total above ${fmtUsd(minVolume)})`,
          "",
        ];

        const swaps = rows(d.swaps);
        if (!Array.isArray(d.swaps)) {
          lines.push(...missingList(d.swaps));
        } else if (swaps.length === 0) {
          lines.push("No trades found matching the criteria.");
        } else {
          for (const s of swaps) {
            const name = firstOf([s.traderName, s.trader], "unknown wallet");
            const insider = s.isVesting === true ? " [INSIDER]" : "";
            const price = positive(s.effectivePrice);
            const at = price === null ? "" : ` @ ${fmtPrice(price)}`;
            lines.push(`- ${tradeSide(s.direction)} ${fmtUsd(s.volumeUsd)} (${fmtToken(s.tokenAmount, str(s.tokenLabel))}${at}) via ${firstOf([s.poolName], "unknown pool")} (${firstOf([s.dex], "unknown DEX")}) by ${name}${insider} — ${fmtAgo(s.timestamp)}`);
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
