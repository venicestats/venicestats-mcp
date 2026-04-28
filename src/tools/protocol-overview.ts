import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtUsd, fmtToken, fmtPct, fmtRatio } from "../lib/format.js";

interface MetricsResponse {
  vvvPrice: number;
  priceChange24h: number;
  marketCap: number;
  fdv: number;
  totalSupply: number;
  circulatingSupply: number;
  burnedSupply: number;
  totalStaked: number;
  stakingRatio: number;
  stakerApr: number;
  svvvLocked: number;
  lockRatio: number;
  emissionPerYear: number;
  diemPrice: number;
  diemPriceChange24h: number;
  diemSupply: number;
  diemStaked: number;
  diemStakeRatio: number;
  mintRate: number;
  mintCostUsd: number;
  mintParity: number;
  diemBreakEvenDays: number;
  remainingMintable: number;
  totalBurnedFromEvents: number;
  organicBurned: number;
  burnRevenueAnnualized: number;
  burnDeflationRate: number;
  ecosystemTvl: number;
  veniceRevenue: number;
  peRatio: number;
  impliedConfidence: number;
  netFlow7d: number;
  newStakers7dCount: number;
  activeWallets7dCount: number;
  stakingGrowth7d: number;
  stakingGrowth30d: number;
  cooldownVvv: number;
  cooldownWallets: number;
  vestingTotalLocked: number;
  vestingDailyDrip: number;
  vestingActiveStreams: number;
  lastUpdated: string | null;
}

const CATEGORIES = ["token", "staking", "diem", "burns", "economics", "growth", "vesting"] as const;

function formatCategory(cat: string, d: MetricsResponse): string[] {
  switch (cat) {
    case "token":
      return [
        `## Token`,
        `Price: ${fmtUsd(d.vvvPrice)} (${fmtPct(d.priceChange24h)})`,
        `Market Cap: ${fmtUsd(d.marketCap)} | FDV: ${fmtUsd(d.fdv)}`,
        `Total Supply: ${fmtToken(d.totalSupply, "VVV")}`,
        `Circulating: ${fmtToken(d.circulatingSupply)} | Burned: ${fmtToken(d.burnedSupply)}`,
      ];
    case "staking":
      return [
        `## Staking`,
        `Total Staked: ${fmtToken(d.totalStaked, "sVVV")} (${fmtRatio(d.stakingRatio)})`,
        `APR: ${d.stakerApr.toFixed(1)}% | Locked: ${fmtToken(d.svvvLocked)} (${fmtRatio(d.lockRatio)})`,
        `Emission: ${fmtToken(d.emissionPerYear, "VVV")}/year`,
      ];
    case "diem":
      return [
        `## DIEM`,
        `Price: ${fmtUsd(d.diemPrice)} (${fmtPct(d.diemPriceChange24h)})`,
        `Supply: ${fmtToken(d.diemSupply, "DIEM")} | Staked: ${fmtToken(d.diemStaked)} (${fmtRatio(d.diemStakeRatio)})`,
        `Mint Rate: ${Math.round(d.mintRate)} sVVV/DIEM | Mint Cost: ${fmtUsd(d.mintCostUsd)}`,
        `Market Discount: ${fmtRatio(1 - d.mintParity)} vs mint cost`,
        `Break-even: ${d.diemBreakEvenDays} days | Remaining mintable: ${fmtToken(d.remainingMintable, "DIEM")}`,
      ];
    case "burns":
      return [
        `## Burns & Revenue`,
        `Total Burned: ${fmtToken(d.totalBurnedFromEvents, "VVV")} (${fmtToken(d.organicBurned)} organic)`,
        `Annualized Revenue: ${fmtUsd(d.burnRevenueAnnualized)}`,
        `Deflation Rate: ${d.burnDeflationRate.toFixed(2)}%/year`,
      ];
    case "economics":
      return [
        `## Economics`,
        `Ecosystem TVL: ${fmtUsd(d.ecosystemTvl)}`,
        `Venice Revenue (est.): ${fmtUsd(d.veniceRevenue)}/year`,
        // peRatio field name is legacy; conceptually it's Price-to-Sales
        // (marketCap / annualised burn revenue, not earnings).
        `P/S Ratio: ${d.peRatio.toFixed(1)}x (mkt cap ÷ annualised burn revenue; this is P/S — Venice doesn't publish net earnings)`,
        `Implied Confidence: ${d.impliedConfidence.toFixed(2)}x`,
      ];
    case "growth":
      return [
        `## Growth & Activity`,
        `Net Flow (7d): ${fmtToken(d.netFlow7d, "VVV")}`,
        `Staking Growth: 7d ${fmtPct(d.stakingGrowth7d)} | 30d ${fmtPct(d.stakingGrowth30d)}`,
        `New Stakers (7d): ${d.newStakers7dCount} | Active Wallets: ${d.activeWallets7dCount}`,
        `Cooldown: ${fmtToken(d.cooldownVvv, "VVV")} across ${d.cooldownWallets} wallets`,
      ];
    case "vesting":
      return [
        `## Vesting`,
        `Locked: ${fmtToken(d.vestingTotalLocked, "VVV")}`,
        `Daily Drip: ${fmtToken(d.vestingDailyDrip, "VVV")}/day`,
        `Active Streams: ${d.vestingActiveStreams}`,
      ];
    default:
      return [];
  }
}

export function registerProtocolOverviewTool(server: McpServer) {
  server.tool(
    "venicestats_protocol_overview",
    "Returns a comprehensive Venice protocol snapshot from VeniceStats.com — 40+ KPIs by category (token, staking, diem, burns, economics, growth, vesting). Use category param to focus, or omit for full picture. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      category: z.enum(CATEGORIES).optional().describe("Focus on a specific category. Omit for full overview."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ category }) => {
      try {
        const d = await apiGet<MetricsResponse>("/api/metrics");

        const cats = category ? [category] : [...CATEGORIES];
        const sections = cats.flatMap((c) => [...formatCategory(c, d), ""]);
        sections.push(deepLinkLine("/"));

        return brandedResponse(sections.join("\n"), {
          deepLink: "/",
          tip: category
            ? `Omit the category parameter to see the full protocol overview.`
            : "Use venicestats_price for a quick price check, or venicestats_wallet to look up a specific holder.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
