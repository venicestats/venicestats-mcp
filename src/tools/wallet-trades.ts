import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { firstOf, fmtAgo, fmtCount, fmtPrice, fmtToken, fmtUsd, num, positive, rows, str } from "../lib/format.js";
import { tradeSide } from "./large-trades.js";

interface Swap {
  direction: string;
  token: string;
  amount: number;
  effectivePrice: number | null;
  volumeUsd: number;
  via: string;
  timestamp: string;
}

interface CostBasis {
  avgBuyPrice: number | null;
  avgSellPrice: number | null;
  totalBought: number;
  totalSold: number;
  netPosition: number;
  invested: number | null;
  extracted: number | null;
}

interface WalletSwapsResponse {
  swaps: Swap[];
  costBasis: Record<string, CostBasis>;
  insights: string[];
  total: number;
}

export function registerWalletTradesTool(server: McpServer) {
  server.tool(
    "venicestats_wallet_trades",
    "Returns a wallet's trading history from VeniceStats.com — swaps, cost basis, PnL, behavioral insights. Use when someone asks about a wallet's trading activity or profitability. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address").describe("Ethereum wallet address to look up"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ address }) => {
      try {
        const d = await apiGet<WalletSwapsResponse>("/api/wallet-swaps", { address });

        const lines = [
          `## Trading History — ${address}`,
          `${fmtCount(d.total)} trades total`,
          "",
        ];

        // Cost basis per token
        for (const [token, cb] of Object.entries(d.costBasis ?? {})) {
          if (!cb) continue;
          lines.push(`### ${token} Cost Basis`);
          if (num(cb.avgBuyPrice) !== null) lines.push(`Avg Buy: ${fmtPrice(cb.avgBuyPrice)} | Bought: ${fmtToken(cb.totalBought, token)}`);
          if (num(cb.avgSellPrice) !== null) lines.push(`Avg Sell: ${fmtPrice(cb.avgSellPrice)} | Sold: ${fmtToken(cb.totalSold, token)}`);
          lines.push(`Net Position: ${fmtToken(cb.netPosition, token)}`);
          if (num(cb.invested) !== null) lines.push(`Invested: ${fmtUsd(cb.invested)}`);
          if (num(cb.extracted) !== null) lines.push(`Extracted: ${fmtUsd(cb.extracted)}`);
          lines.push("");
        }

        // Insights
        const insights = rows(d.insights).map((i) => str(i)).filter((i) => i !== null);
        if (insights.length > 0) {
          lines.push(`### Insights`, ...insights.map((i) => `- ${i}`), "");
        }

        // Recent trades (last 5)
        const recent = rows(d.swaps).slice(0, 5);
        if (recent.length > 0) {
          lines.push(`### Recent Trades`);
          for (const s of recent) {
            const price = positive(s.effectivePrice);
            const at = price === null ? "" : ` @ ${fmtPrice(price)}`;
            lines.push(`- ${tradeSide(s.direction)} ${fmtToken(s.amount, str(s.token))}${at} (${fmtUsd(s.volumeUsd)}) via ${firstOf([s.via], "unknown route")} — ${fmtAgo(s.timestamp)}`);
          }
        }

        lines.push("", deepLinkLine(`/wallet/${address}`));

        return brandedResponse(lines.join("\n"), {
          deepLink: `/wallet/${address}`,
          tip: "Use venicestats_wallet for this wallet's full Venetian identity (role, badges, radar).",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
