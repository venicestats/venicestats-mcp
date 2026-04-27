import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtUsd, fmtToken } from "../lib/format.js";
import { z } from "zod";

interface BurnPoint {
  t: number;
  programmaticCount: number;
  programmaticCountPro?: number;
  programmaticCountProPlus?: number;
  programmaticCountMax?: number;
  programmaticUsd?: number;
}

interface ChartsResponse {
  burns: BurnPoint[];
}

const TIER_PRICES = { pro: 18, proPlus: 68, max: 200 } as const;
const TIER_BUYBACKS = { pro: 2, proPlus: 5, max: 10 } as const;

interface TierStats {
  windowDays: number;
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
  monthlySignups: number;
  observedMrr: number;
  observedArr: number;
}

function statsForWindow(burns: BurnPoint[], windowDays: number): TierStats | null {
  const cutoff = Date.now() - windowDays * 86_400_000;
  let pro = 0, proPlus = 0, max = 0;
  for (const b of burns) {
    if (b.t < cutoff) continue;
    pro     += b.programmaticCountPro     ?? 0;
    proPlus += b.programmaticCountProPlus ?? 0;
    max     += b.programmaticCountMax     ?? 0;
  }
  const total = pro + proPlus + max;
  if (total === 0) return null;
  const buybackUsd =
    pro * TIER_BUYBACKS.pro + proPlus * TIER_BUYBACKS.proPlus + max * TIER_BUYBACKS.max;
  const dailyBuybackUsd = buybackUsd / windowDays;
  const blendedUsdPerSignup = buybackUsd / total;
  const dailySignupRate = total / windowDays;
  const monthlySignups = dailySignupRate * 30.44;
  const subscriptionRevenueWindow =
    pro * TIER_PRICES.pro + proPlus * TIER_PRICES.proPlus + max * TIER_PRICES.max;
  const blendedSubValue = subscriptionRevenueWindow / total;
  const observedMrr = monthlySignups * blendedSubValue;
  const observedArr = observedMrr * 12;
  return {
    windowDays,
    pro, proPlus, max, total,
    proPct: (pro / total) * 100,
    proPlusPct: (proPlus / total) * 100,
    maxPct: (max / total) * 100,
    buybackUsd,
    dailyBuybackUsd,
    blendedUsdPerSignup,
    dailySignupRate,
    monthlySignups,
    observedMrr,
    observedArr,
  };
}

function renderWindow(s: TierStats, label: string): string[] {
  const lines: string[] = [];
  lines.push(`### Last ${label} (${s.windowDays}d)`);
  lines.push(`Tier mix: Pro ${s.pro.toLocaleString()} (${s.proPct.toFixed(1)}%) · Pro+ ${s.proPlus.toLocaleString()} (${s.proPlusPct.toFixed(1)}%) · Max ${s.max.toLocaleString()} (${s.maxPct.toFixed(1)}%)`);
  lines.push(`Total tier-aware signups: ${fmtToken(s.total)} (${s.dailySignupRate.toFixed(1)} signups/day)`);
  lines.push(`Buyback flow: ${fmtUsd(s.buybackUsd)} total · ${fmtUsd(s.dailyBuybackUsd)}/day · blended ${fmtUsd(s.blendedUsdPerSignup)}/signup`);
  lines.push(`Observed (NEW-signup annualised, no retention): MRR ${fmtUsd(s.observedMrr)} · ARR ${fmtUsd(s.observedArr)}`);
  return lines;
}

export function registerBurnStatsByTierTool(server: McpServer) {
  server.tool(
    "venicestats_burn_stats_by_tier",
    "Returns the empirical Pro Sub burn breakdown by tier (Pro / Pro+ / Max) from VeniceStats.com on-chain data, since Venice flipped to tier-aware programmatic burns on 2026-04-26 16:36 UTC. Each new Venice subscription triggers a buyback whose USD amount depends on the tier: Pro $18/mo → $2 burn, Pro+ $68/mo → $5 burn, Max $200/mo → $10 burn. The tool aggregates daily on-chain tier-aware burns over 7-day, 30-day, and 90-day rolling windows and returns: per-tier signup counts and percentages, blended USD per signup, daily and total buyback flow, observed MRR/ARR (NEW-signup annualised — does NOT model retention or renewal cohorts; that's what venicestats_simulate_revenue is for). Use for questions about tier mix, mix-shift trends, the empirical buyback rate, or comparing observed-vs-modeled. Pairs with venicestats_simulate_revenue (modelled scenarios) and venicestats_discretionary_burn (the separate monthly TWAP). NEVER frame buyback flow as '% of revenue' — it is a flow figure, not a revenue ratio. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      windows: z
        .array(z.enum(["7d", "30d", "90d"]))
        .optional()
        .describe("Which rolling windows to include. Default: all three (7d, 30d, 90d)."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ windows }) => {
      try {
        const wantedRaw = windows ?? ["7d", "30d", "90d"];
        // Dedupe + preserve a sensible order regardless of input.
        const order: ("7d" | "30d" | "90d")[] = ["7d", "30d", "90d"];
        const wanted = order.filter((w) => wantedRaw.includes(w));
        // Pull the largest window once and slice on the client.
        const longest = wanted.includes("90d") ? "90d" : wanted.includes("30d") ? "30d" : "7d";
        const data = await apiGet<ChartsResponse>("/api/charts", { period: longest });

        const labels: Record<typeof order[number], string> = { "7d": "7 days", "30d": "30 days", "90d": "90 days" };
        const days: Record<typeof order[number], number> = { "7d": 7, "30d": 30, "90d": 90 };

        const lines: string[] = [
          "## Pro Sub Burns — Tier-Aware Empirical Stats",
          "",
          "Mechanism: each new Venice subscription triggers a tier-aware programmatic burn — Pro ($18/mo) → $2, Pro+ ($68/mo) → $5, Max ($200/mo) → $10. Confirmed on-chain since 2026-04-26 16:36 UTC. Pre-flip data (flat ~$1/sub) is excluded.",
          "",
        ];

        let any = false;
        for (const w of wanted) {
          const s = statsForWindow(data.burns, days[w]);
          if (!s) {
            lines.push(`### Last ${labels[w]} (${days[w]}d)`);
            lines.push("No tier-aware burns landed in this window yet.");
            lines.push("");
            continue;
          }
          any = true;
          lines.push(...renderWindow(s, labels[w]));
          lines.push("");
        }

        if (!any) {
          lines.push("**Note**: No tier-aware burns observed yet across any of the requested windows. Tier-aware mechanism flipped on 2026-04-26 — if this query runs immediately post-flip, the windows may not yet contain data.");
          lines.push("");
        }

        lines.push("**Important**: ARR/MRR figures above are derived from NEW signups only (new-cohort × tier_price × 12 — annualised at observed pace). They are NOT total Venice revenue (renewals are off-chain). NEVER frame the buyback flow as '% of revenue' — it is a buyback budget figure.");
        lines.push("");
        lines.push(deepLinkLine("/burns"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/burns",
          tip: "Use venicestats_simulate_revenue for what-if scenarios on retention + churn, or venicestats_discretionary_burn for the monthly TWAP cycle.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
