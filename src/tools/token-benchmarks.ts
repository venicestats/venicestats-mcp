import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { NA, firstOf, fmtPct, fmtUsd, missingList, num, positive, rows, str, text, type Maybe } from "../lib/format.js";

interface BenchmarkToken {
  symbol: string;
  name: string;
  chain: string | null;
  year: number | null;
  category: string | null;
  description: string | null;
  keyFact: string | null;
  priceUsd: number;
  marketCap: number | null;
  volume24h: number | null;
  change24h: number | null;
  change7d: number | null;
  change30d: number | null;
  rank: number | null;
}

interface BenchmarksResponse {
  count: number;
  tokens: BenchmarkToken[];
}

type Token = NonNullable<Maybe<BenchmarkToken>>;

const SECTORS: Record<string, string> = {
  "macro-benchmark": "Macro",
  "ai-inference": "AI Inference",
  "ai-agents": "AI Agents",
  "depin-infra": "DePIN",
  "compute-gpu": "Compute/GPU",
};

function sectorLabel(category: unknown): string {
  const c = str(category);
  return c === null ? NA : (SECTORS[c] ?? c);
}

export function registerTokenBenchmarksTool(server: McpServer) {
  server.tool(
    "venicestats_token_benchmarks",
    "Returns real-time market data for AI/DePIN/Compute tokens from VeniceStats.com — price, market cap, 24h volume ranking, 24h/7d/30d performance, rank, plus project metadata (chain, sector, description, key fact). Perfect for comparing Venice (VVV) against competitors like Bittensor (TAO), Render (RENDER), Fetch.ai (FET), Akash (AKT), Virtuals (VIRTUAL), io.net (IO), Aethir (ATH) etc. Filter by symbol, by sector category, or get all. Use for cross-token comparisons, sector rankings, competitor analysis, momentum scans, or 'how does VVV compare to X?' questions. Data combines our on-chain VVV/DIEM pipeline with CoinGecko for external tokens. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
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
        const tokens = rows(d.tokens);

        if (tokens.length === 0) {
          return brandedResponse(
            missingList(d.tokens)[0] ?? "No tokens match the given filters.",
            {
              deepLink: "/intelligence",
              tip: "Try broadening your filter, or use a category like 'ai-inference' or 'ai-agents'.",
            },
          );
        }

        // Sort in-process, tokens without the value last
        const sortValue: Record<string, (t: Token) => number | null> = {
          market_cap: (t) => num(t.marketCap),
          change_24h: (t) => num(t.change24h),
          change_7d: (t) => num(t.change7d),
          change_30d: (t) => num(t.change30d),
          volume: (t) => num(t.volume24h),
        };
        const sorted = [...tokens].sort((a, b) => {
          const x = sortValue[sort_by](a);
          const y = sortValue[sort_by](b);
          if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
          return y - x;
        });
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
          `Showing top ${top.length} of ${num(d.count) ?? tokens.length} tracked tokens, sorted ${sortLabel[sort_by]}.`,
          "",
          `| # | Token | Sector | Price | Market Cap | 24h | 7d | 30d |`,
          `|---|-------|--------|-------|------------|-----|----|----|`,
        ];

        top.forEach((t, i) => {
          lines.push(
            `| ${i + 1} | **${text(t.symbol)}** (${text(t.name)}) | ${sectorLabel(t.category)} | ${fmtUsd(positive(t.priceUsd))} | ${fmtUsd(positive(t.marketCap))} | ${fmtPct(t.change24h)} | ${fmtPct(t.change7d)} | ${fmtPct(t.change30d)} |`,
          );
        });

        // Extra context: metadata for small result sets
        if (top.length <= 5) {
          lines.push("", "### Project Context");
          for (const t of top) {
            const meta: string[] = [];
            const chain = str(t.chain);
            const year = positive(t.year);
            const rank = positive(t.rank);
            const keyFact = str(t.keyFact);
            if (chain !== null) meta.push(`Chain: ${chain}`);
            if (year !== null) meta.push(`Listed: ${year}`);
            if (rank !== null) meta.push(`Rank: #${rank}`);
            lines.push(
              `- **${text(t.symbol)}** — ${firstOf([t.description], "no description")}${meta.length ? ` _(${meta.join(" | ")})_` : ""}`,
            );
            if (keyFact !== null) lines.push(`  - Key fact: ${keyFact}`);
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
