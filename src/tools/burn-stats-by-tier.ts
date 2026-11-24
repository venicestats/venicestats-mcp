import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtCount, fmtDate, fmtFixed, fmtShare, fmtToken, fmtUsd, num, positive, type Maybe } from "../lib/format.js";

interface TierStats {
  windowDays: number;
  /** Closed UTC days with data: what the per-day figures are divided by. */
  daysCovered?: number;
  /** False when a day of the window is missing. */
  complete?: boolean;
  windowStart?: string;
  windowEnd?: string;
  pro: number;
  proPlus: number;
  max: number;
  total: number;
  proPct: number;
  proPlusPct: number;
  maxPct: number;
  buybackUsd: number;
  dailyBuybackUsd: number;
  blendedUsdPerSignup: number;
  dailySignupRate: number;
  observedMrr: number;
  observedArr: number;
}

interface TierPrice {
  monthlyPrice: number;
  buyback: number;
}

interface TierStatsResponse {
  flipTs: string;
  mechanism: { pro: TierPrice; proPlus: TierPrice; max: TierPrice };
  windows: Record<string, TierStats | null>;
}

const WINDOWS = ["7d", "30d", "90d"] as const;

function renderWindow(s: NonNullable<Maybe<TierStats>>): string[] {
  const lines: string[] = [
    `Tier mix: Pro ${fmtCount(s.pro)} (${fmtShare(s.proPct)}) · Pro+ ${fmtCount(s.proPlus)} (${fmtShare(s.proPlusPct)}) · Max ${fmtCount(s.max)} (${fmtShare(s.maxPct)})`,
    `Total tier-aware signups: ${fmtToken(s.total)} (${fmtFixed(s.dailySignupRate, 1)} signups/day)`,
    `Buyback flow: ${fmtUsd(s.buybackUsd)} total · ${fmtUsd(s.dailyBuybackUsd)}/day · blended ${fmtUsd(s.blendedUsdPerSignup)}/signup`,
    `Observed (NEW-signup annualised, no retention): MRR ${fmtUsd(s.observedMrr)} · ARR ${fmtUsd(s.observedArr)}`,
  ];
  if (s.complete === false) {
    lines.push(`Incomplete window: ${fmtCount(s.daysCovered)} of ${fmtCount(s.windowDays)} days have data; per-day figures use the days covered.`);
  }
  return lines;
}

function mechanismLine(m: Maybe<TierStatsResponse["mechanism"]>, flipTs: unknown): string {
  const part = (label: string, t: Maybe<TierPrice>): string | null =>
    num(t?.monthlyPrice) === null || num(t?.buyback) === null
      ? null
      : `${label} ($${fmtCount(t?.monthlyPrice)}/mo) → $${fmtCount(t?.buyback)}`;
  const parts = [part("Pro", m?.pro), part("Pro+", m?.proPlus), part("Max", m?.max)].filter((p) => p !== null);
  const tiers = parts.length > 0 ? `: ${parts.join(", ")}` : "";
  return `Mechanism: each new Venice subscription triggers a programmatic burn whose size depends on the tier${tiers}. Tier-aware on-chain since ${fmtDate(flipTs)}; earlier burns are excluded.`;
}

export function registerBurnStatsByTierTool(server: McpServer) {
  server.tool(
    "venicestats_burn_stats_by_tier",
    "Returns the empirical Pro Sub burn breakdown by tier (Pro / Pro+ / Max) from VeniceStats.com on-chain data. Each new Venice subscription triggers a buyback whose USD amount depends on the tier (the response lists current prices and buybacks). Aggregates tier-aware burns over 7-day, 30-day and 90-day windows and returns: per-tier signup counts and percentages, blended USD per signup, daily and total buyback flow, observed MRR/ARR (NEW-signup annualised — does NOT model retention or renewal cohorts; that's what venicestats_simulate_revenue is for). Use for questions about tier mix, mix-shift trends, the empirical buyback rate, or comparing observed-vs-modeled. NOT the answer to 'what is Venice's revenue today' (use venicestats_simulate_revenue). NEVER frame buyback flow as '% of revenue' — it is a flow figure, not a revenue ratio. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      windows: z
        .array(z.enum(WINDOWS))
        .optional()
        .describe("Which rolling windows to include. Default: all three (7d, 30d, 90d)."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ windows }) => {
      try {
        // Dedupe + preserve a sensible order regardless of input.
        const asked = windows && windows.length > 0 ? windows : WINDOWS;
        const wanted = WINDOWS.filter((w) => asked.includes(w));
        const d = await apiGet<TierStatsResponse>("/api/burn-stats-by-tier", { windows: wanted.join(",") });

        const lines: string[] = [
          "## Pro Sub Burns — Tier-Aware Empirical Stats",
          "",
          mechanismLine(d.mechanism, d.flipTs),
          "",
        ];

        for (const w of wanted) {
          const s = d.windows?.[w];
          lines.push(`### Last ${w.replace("d", " days")}`);
          // A window without signups is not a window with zero signups: they arrive every minute.
          if (s === null || s === undefined || positive(s.total) === null) lines.push("n/a — no tier data for this window right now.");
          else lines.push(...renderWindow(s));
          lines.push("");
        }

        lines.push("**Important**: ARR/MRR figures above are derived from NEW signups only (new-cohort × tier_price × 12 — annualised at observed pace). They are NOT total Venice revenue (renewals are off-chain). NEVER frame the buyback flow as '% of revenue' — it is a buyback budget figure.");
        lines.push("");
        lines.push(deepLinkLine("/burns"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/burns",
          tip: "Use venicestats_simulate_revenue for modeled revenue today and what-if scenarios on churn, or venicestats_discretionary_burn for the monthly TWAP cycle.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
