import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtUsd, fmtPct } from "../lib/format.js";

interface BenchmarkToken {
  coingeckoId: string;
  symbol: string;
  name: string;
  chain: string | null;
  year: number | null;
  category: string | null;
  description: string | null;
  keyFact: string | null;
  priceUsd: number;
  marketCap: number | null;
  fdv: number | null;
  volume24h: number | null;
  change1h: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  ath: number | null;
  athDate: string | null;
  rank: number | null;
}

interface BenchmarksResponse {
  count: number;
  tokens: BenchmarkToken[];
  history?: Record<
    string,
    { date: string; price: number; marketCap: number | null; volume: number | null }[]
  >;
  categories?: Record<string, { label: string; description: string }>;
}

function formatChange(n: number | null): string {
  if (n == null) return "—";
  return fmtPct(n);
}

function sectorLabel(category: string | null): string {
  if (!category) return "—";
  const map: Record<string, string> = {
    "macro-benchmark": "Macro",
    "ai-inference": "AI Inference",
    "ai-agents": "AI Agents",
    "depin-infra": "DePIN",
    "compute-gpu": "Compute/GPU",
  };
  return map[category] ?? category;
}

export function registerTokenBenchmarksTool(server: McpServer) {
  server.tool(
    "venicestats_token_benchmarks",
    "Returns real-time market data for 63 AI/DePIN/Compute tokens from VeniceStats.com — price, market cap, FDV, 24h volume, 1h/24h/7d/30d performance, ATH, rank, plus project metadata (chain, sector, description, key fact). Perfect for comparing Venice (VVV) against competitors like Bittensor (TAO), Render (RENDER), Fetch.ai (FET), Akash (AKT), Virtuals (VIRTUAL), io.net (IO), Aethir (ATH) etc. Filter by symbol, by sector category, or get all. Use for cross-token comparisons, sector rankings, competitor analysis, momentum scans, or 'how does VVV compare to X?' questions. Data combines our on-chain VVV/DIEM pipeline with CoinGecko for external tokens. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      symbols: z
        .string()
        .optional()
        .describe(
          "Comma-separated token symbols to filter (e.g. 'TAO,RENDER,FET'). Omit for all tracked tokens.",
        ),
      category: z
        .enum([
          "macro-benchmark",
          "ai-inference",
          "ai-agents",
          "depin-infra",
          "compute-gpu",
        ])
        .optional()
        .describe("Filter by sector category"),
      sort_by: z
        .enum(["market_cap", "change_24h", "change_7d", "change_30d", "volume"])
        .default("market_cap")
        .describe("Sort tokens (default: market_cap descending)"),
      limit: z
        .number()
        .min(1)
        .max(65)
        .default(20)
        .describe("Max number of tokens to display in the table (default: 20)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ symbols, category, sort_by, limit }) => {
      try {
        const params: Record<string, string | number | undefined> = {};
        if (symbols) params.symbols = symbols;
        if (category) params.category = category;

        const d = await apiGet<BenchmarksResponse>("/api/market-data", params);

        if (d.count === 0) {
          return brandedResponse(
            "No tokens match the given filters.",
            {
              deepLink: "/intelligence",
              tip: "Try broadening your filter, or use a category like 'ai-inference' or 'ai-agents'.",
            },
          );
        }

        // Sort in-process
        const sortKey: Record<string, (t: BenchmarkToken) => number> = {
          market_cap: (t) => -(t.marketCap ?? 0),
          change_24h: (t) => -(t.change24h ?? -Infinity),
          change_7d: (t) => -(t.change7d ?? -Infinity),
          change_30d: (t) => -(t.change30d ?? -Infinity),
          volume: (t) => -(t.volume24h ?? 0),
        };
        const sorted = [...d.tokens].sort(
          (a, b) => sortKey[sort_by](a) - sortKey[sort_by](b),
        );
        const top = sorted.slice(0, limit);

        const sortLabel: Record<string, string> = {
          market_cap: "by market cap",
          change_24h: "by 24h change",
          change_7d: "by 7d change",
          change_30d: "by 30d change",
          volume: "by 24h volume",
        };

        const lines: string[] = [
          `## Token Benchmarks — VeniceStats${category ? ` (${sectorLabel(category)})` : ""}`,
          `Showing top ${top.length} of ${d.count} tracked tokens, sorted ${sortLabel[sort_by]}.`,
          "",
          `| # | Token | Sector | Price | Market Cap | 24h | 7d | 30d |`,
          `|---|-------|--------|-------|------------|-----|----|----|`,
        ];

        top.forEach((t, i) => {
          lines.push(
            `| ${i + 1} | **${t.symbol}** (${t.name}) | ${sectorLabel(t.category)} | ${fmtUsd(t.priceUsd)} | ${t.marketCap != null ? fmtUsd(t.marketCap) : "—"} | ${formatChange(t.change24h)} | ${formatChange(t.change7d)} | ${formatChange(t.change30d)} |`,
          );
        });

        // Extra context: metadata for small result sets
        if (top.length <= 5) {
          lines.push("", "### Project Context");
          for (const t of top) {
            const meta: string[] = [];
            if (t.chain) meta.push(`Chain: ${t.chain}`);
            if (t.year) meta.push(`Listed: ${t.year}`);
            if (t.rank) meta.push(`Rank: #${t.rank}`);
            lines.push(
              `- **${t.symbol}** — ${t.description ?? ""}${meta.length ? ` _(${meta.join(" | ")})_` : ""}`,
            );
            if (t.keyFact) lines.push(`  - Key fact: ${t.keyFact}`);
          }
        }

        lines.push(
          "",
          "Data: VeniceStats on-chain pipeline (VVV/DIEM) + CoinGecko (external tokens). VVV is NOT in this benchmark list — use venicestats_price for current VVV data.",
          "",
          deepLinkLine("/intelligence"),
        );

        return brandedResponse(lines.join("\n"), {
          deepLink: "/intelligence",
          tip: "Use venicestats_price for VVV-specific data, or venicestats_protocol_overview for a VVV snapshot you can compare against these benchmarks.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
