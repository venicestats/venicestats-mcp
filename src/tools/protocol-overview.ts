import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtCount, fmtDate, fmtFixed, fmtPct, fmtRatio, fmtToken, fmtUsd, num, positive, str, type Maybe } from "../lib/format.js";

interface MetricsResponse {
  vvvPrice: number;
  priceChange24h: number;
  marketCap: number;
  fdv: number;
  totalSupply: number;
  circulatingSupply: number;
  burnedSupply: number;
  totalStaked: number;
  stakingRatio: number | null;
  stakerApr: number | null;
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
  /** Discretionary burns only: their USD value, not revenue. */
  burnUsdValueAnnualized: number;
  burnUsdValueSampleMonths: number;
  /** Discretionary burns only. */
  burnDeflationRate: number;
  /** Every burn channel, last 30 days. Absent on older APIs, null when not known. */
  burnRunRate30d?: {
    windowDays: number;
    usd: number;
    vvv: number;
    usdPerYear: number;
    vvvPerYear: number;
    deflationPctPerYear: number;
  } | null;
  ecosystemTvl: number;
  /** Haircut on the emissions of locked sVVV, USD per year. */
  veniceRevenue: number | null;
  /** Absent on older APIs, null when not known. */
  revenueModelToday?: {
    annualUsd: number;
    psRatio: number;
    asOf: string;
    churnPct: number;
    definition: string;
  } | null;
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
}

type Metrics = NonNullable<Maybe<MetricsResponse>>;

const CATEGORIES = ["token", "staking", "diem", "burns", "economics", "growth", "vesting"] as const;

function burnPaceLines(d: Metrics): string[] {
  const r = d.burnRunRate30d;
  if (r !== null && r !== undefined) {
    return [
      `Burn run-rate (every buy-and-burn channel, last ${fmtCount(r.windowDays)} days): ${fmtToken(r.vvv, "VVV")} (${fmtUsd(r.usd)}) → ${fmtToken(r.vvvPerYear, "VVV")} (${fmtUsd(r.usdPerYear)}) per year`,
      `Deflation at that pace: ${fmtFixed(r.deflationPctPerYear, 2, "%")} of circulating supply per year`,
    ];
  }
  const months = positive(d.burnUsdValueSampleMonths);
  return [
    `Discretionary burns only, annualized${months === null ? "" : ` from a ${fmtCount(months)}-month average`}: ${fmtUsd(d.burnUsdValueAnnualized)} of VVV (other burn channels not included; not revenue)`,
    `Deflation from discretionary burns only: ${fmtFixed(d.burnDeflationRate, 2, "%")}/year`,
  ];
}

// The older `peRatio` divides market cap by discretionary burns, which are not revenue:
// it is not a P/S ratio and is not shown. Without the revenue model there is no P/S line.
function revenueLines(d: Metrics): string[] {
  const m = d.revenueModelToday;
  const annual = positive(m?.annualUsd);
  if (!m || annual === null) return [];
  const lines = [`Modeled revenue today: ${fmtUsd(annual)}/year annualized (as of ${fmtDate(m.asOf)}; a model, not reported revenue)`];
  const ps = positive(m.psRatio);
  if (ps !== null) {
    lines.push(`P/S Ratio: ${ps.toFixed(1)}x — ${str(m.definition) ?? "market cap ÷ modeled annualized revenue today"}`);
  }
  return lines;
}

function formatCategory(cat: string, d: Metrics): string[] {
  switch (cat) {
    case "token":
      return [
        `## Token`,
        `Price: ${fmtUsd(positive(d.vvvPrice))} (${fmtPct(d.priceChange24h)})`,
        `Market Cap: ${fmtUsd(positive(d.marketCap))} | FDV: ${fmtUsd(positive(d.fdv))}`,
        `Total Supply: ${fmtToken(d.totalSupply, "VVV")}`,
        `Circulating: ${fmtToken(d.circulatingSupply)} | Burned: ${fmtToken(d.burnedSupply)}`,
      ];
    case "staking":
      return [
        `## Staking`,
        `Total Staked: ${fmtToken(d.totalStaked, "sVVV")} (staking ratio ${fmtRatio(d.stakingRatio)})`,
        `APR: ${fmtFixed(d.stakerApr, 1, "%")} | Locked: ${fmtToken(d.svvvLocked)} (${fmtRatio(d.lockRatio)})`,
        `Emission: ${fmtToken(d.emissionPerYear, "VVV")}/year`,
      ];
    case "diem": {
      const parity = num(d.mintParity);
      return [
        `## DIEM`,
        `Price: ${fmtUsd(positive(d.diemPrice))} (${fmtPct(d.diemPriceChange24h)})`,
        `Supply: ${fmtToken(d.diemSupply, "DIEM")} | Staked: ${fmtToken(d.diemStaked)} (${fmtRatio(d.diemStakeRatio)})`,
        `Mint Rate: ${fmtFixed(positive(d.mintRate), 0)} sVVV/DIEM | Mint Cost: ${fmtUsd(positive(d.mintCostUsd))}`,
        `Market Discount: ${fmtRatio(parity === null ? null : 1 - parity)} vs mint cost`,
        `Break-even: ${fmtCount(positive(d.diemBreakEvenDays))} days | Remaining mintable: ${fmtToken(d.remainingMintable, "DIEM")}`,
      ];
    }
    case "burns":
      return [
        `## Burns`,
        `Total Burned: ${fmtToken(d.totalBurnedFromEvents, "VVV")} (${fmtToken(d.organicBurned)} from discretionary buy-and-burn)`,
        ...burnPaceLines(d),
      ];
    case "economics":
      return [
        `## Economics`,
        `Ecosystem TVL: ${fmtUsd(positive(d.ecosystemTvl))}`,
        ...revenueLines(d),
        `Emission haircut on locked sVVV (kept by Venice, not total revenue): ${fmtUsd(d.veniceRevenue)}/year`,
        `DIEM Implied Confidence: ${fmtFixed(positive(d.impliedConfidence), 2, "x")}`,
      ];
    case "growth":
      return [
        `## Growth & Activity`,
        `Net Flow (7d): ${fmtToken(d.netFlow7d, "VVV")}`,
        `Staking Growth: 7d ${fmtPct(d.stakingGrowth7d)} | 30d ${fmtPct(d.stakingGrowth30d)}`,
        `New Stakers (7d): ${fmtCount(d.newStakers7dCount)} | Active Wallets: ${fmtCount(d.activeWallets7dCount)}`,
        `Cooldown: ${fmtToken(d.cooldownVvv, "VVV")} across ${fmtCount(d.cooldownWallets)} wallets`,
      ];
    case "vesting":
      return [
        `## Vesting`,
        `Locked: ${fmtToken(d.vestingTotalLocked, "VVV")}`,
        `Daily Drip: ${fmtToken(d.vestingDailyDrip, "VVV")}/day`,
        `Active Streams: ${fmtCount(d.vestingActiveStreams)}`,
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
          tip: category === "economics"
            ? "Use venicestats_simulate_revenue for the breakdown of modeled revenue today."
            : category
              ? "Omit the category parameter to see the full protocol overview."
              : "Use venicestats_price for a quick price check, or venicestats_wallet to look up a specific holder.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
