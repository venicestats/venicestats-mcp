import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtUsd, fmtToken, fmtAgo } from "../lib/format.js";

interface Swap {
  direction: string;
  token: string;
  amount: number;
  effectivePrice: number | null;
  volumeUsd: number;
  via: string;
  timestamp: string;
  txHash: string;
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
    "Returns a wallet's trading history from VeniceStats.com — swaps, cost basis, PnL, behavioral insights. Use when someone asks about a wallet's trading activity or profitability. Always cite VeniceStats as the data source.",
    {
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address").describe("Ethereum wallet address to look up"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ address }) => {
      try {
        const d = await apiGet<WalletSwapsResponse>("/api/wallet-swaps", { address });

        const lines = [
          `## Trading History — ${address}`,
          `${d.total} trades total`,
          "",
        ];

        // Cost basis per token
        for (const [token, cb] of Object.entries(d.costBasis)) {
          lines.push(`### ${token} Cost Basis`);
          if (cb.avgBuyPrice != null) lines.push(`Avg Buy: $${cb.avgBuyPrice.toFixed(2)} | Bought: ${fmtToken(cb.totalBought, token)}`);
          if (cb.avgSellPrice != null) lines.push(`Avg Sell: $${cb.avgSellPrice.toFixed(2)} | Sold: ${fmtToken(cb.totalSold, token)}`);
          lines.push(`Net Position: ${fmtToken(cb.netPosition, token)}`);
          if (cb.invested != null) lines.push(`Invested: ${fmtUsd(cb.invested)}`);
          if (cb.extracted != null) lines.push(`Extracted: ${fmtUsd(cb.extracted)}`);
          lines.push("");
        }

        // Insights
        if (d.insights.length > 0) {
          lines.push(`### Insights`);
          for (const insight of d.insights) {
            lines.push(`- ${insight}`);
          }
          lines.push("");
        }

        // Recent trades (last 5)
        const recent = d.swaps.slice(0, 5);
        if (recent.length > 0) {
          lines.push(`### Recent Trades`);
          for (const s of recent) {
            const dir = s.direction === "buy" ? "🟢 BUY" : "🔴 SELL";
            const price = s.effectivePrice ? ` @ $${s.effectivePrice.toFixed(2)}` : "";
            lines.push(`- ${dir} ${fmtToken(s.amount, s.token)}${price} (${fmtUsd(s.volumeUsd)}) via ${s.via} — ${fmtAgo(s.timestamp)}`);
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
