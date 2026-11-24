import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { NA, fmtCount, fmtDate, fmtFixed, fmtToken, fmtUsd, num, positive, rows, str, sumAll, type Maybe } from "../lib/format.js";

/** Monthly churn the site's estimator is calibrated at. */
const DEFAULT_CHURN_PCT = 15;

interface BaseView {
  activeSubs: number;
  mrr: number;
  subsAnnual: number;
  creditsPerDay: number | null;
  creditsAnnual: number | null;
  offChainAnnual: number;
  totalAnnual: number | null;
  psRatio: number | null;
}

interface SimulatorOutput {
  inputs: {
    dist: { pro: number; plus: number; max: number };
    burnModel: "new-subs" | "all-billing";
    churn: number;
    horizonMonths: number;
  };
  wasv: number;
  /** "observed" = 30d empirical mix, "preset" = named preset, "explicit" = caller-supplied "p,p,m" */
  wasvSource?: "observed" | "preset" | "explicit";
  dailyRate: number;
  subsPerMonth: number;
  activeSubs: number | null;
  steadyState: number | null;
  mrr: number;
  arr: number;
  pe: number;
  proSubAnnualUsd: number;
  discretionaryAnnualRunRate: number | null;
  /** Pro Sub + credits + discretionary. Null unless all three are known; absent on older APIs. */
  burnPaceAllChannelsPerYear?: number | null;
  warnings: string[];
  credits?: {
    source: "observed" | "explicit" | "none";
    /** False = the pace is not known and the zeros beside it are not data. Absent on older APIs. */
    known?: boolean;
    buybackPerDay: number;
    annualBuyback?: number | null;
  };
  currentBase?: {
    asOf: string;
    /** False = credits are not known, so no total is. Absent on older APIs. */
    complete?: boolean;
    today: BaseView;
    in12Months: BaseView;
  } | null;
}

type Output = NonNullable<Maybe<SimulatorOutput>>;

/** Whether the pace of credit purchases is known. Older APIs only say it through `source`. */
function creditsKnown(d: Output): boolean {
  if (d.currentBase?.complete === false || d.credits?.known === false) return false;
  if (d.credits?.known === true || d.currentBase?.complete === true) return true;
  return d.credits?.source === "observed" || d.credits?.source === "explicit";
}

function revenueTodayLines(d: Output, known: boolean): string[] {
  const lines = [`### Revenue today (use this for "what is Venice's revenue?")`];
  const b = d.currentBase;
  const t = b?.today;
  if (!b || !t) {
    lines.push(`${NA} — the model of today's revenue is not available right now. Do not use the projection below in its place.`, "");
    return lines;
  }
  const part = (v: unknown): number | null => (known ? num(v) : null);
  const total = positive(part(t.totalAnnual));
  lines.push(
    `Total: ${fmtUsd(total)}/year annualized, as of ${fmtDate(b.asOf)} (a model, not reported revenue)`,
    `- Subscriptions: ${fmtUsd(t.subsAnnual)}/year (${fmtToken(t.activeSubs)} subscribers still paying, MRR ${fmtUsd(t.mrr)})`,
    `- API credits: ${fmtUsd(part(t.creditsAnnual))}/year (${fmtUsd(part(t.creditsPerDay))}/day)`,
    `- Off-chain, constant term: ${fmtUsd(t.offChainAnnual)}/year`,
  );
  if (!known) lines.push("No total: the pace of credit purchases is not known right now, so the parts do not add up to one.");
  const ps = positive(part(t.psRatio));
  if (total !== null && ps !== null) lines.push(`P/S: ${ps.toFixed(1)}× (market cap ÷ the total above)`);
  // Twelve more months of signups need a signup rate.
  const later = positive(d.dailyRate) === null ? null : positive(part(b.in12Months?.totalAnnual));
  if (later !== null) lines.push(`In 12 months at today's pace: ${fmtUsd(later)}/year`);
  lines.push(
    `How it is built: every on-chain signup decayed by monthly churn (${fmtFixed(d.inputs?.churn, 0, "%")}), plus credit purchases at today's pace × 365, plus the off-chain term.`,
    "",
  );
  return lines;
}

function burnPaceLines(d: Output, known: boolean, includeDiscretionary: boolean): string[] {
  const proSub = positive(d.proSubAnnualUsd);
  const perDay = num(d.credits?.buybackPerDay);
  const credits = known ? (num(d.credits?.annualBuyback) ?? (perDay === null ? null : perDay * 365)) : null;
  const discretionary = positive(d.discretionaryAnnualRunRate);
  const all = d.burnPaceAllChannelsPerYear === undefined
    ? sumAll(proSub, credits, discretionary)
    : num(d.burnPaceAllChannelsPerYear);
  return [
    `### Burn Pace (annualised buyback budget, not revenue)`,
    `Pro Sub: ${fmtUsd(proSub)}`,
    `Credits: ${fmtUsd(credits)}`,
    `Discretionary: ${includeDiscretionary ? fmtUsd(discretionary) : "not included"}`,
    ...(includeDiscretionary ? [`The three channels together: ${fmtUsd(all)}`] : []),
    "",
  ];
}

export function registerSimulateRevenueTool(server: McpServer) {
  server.tool(
    "venicestats_simulate_revenue",
    "Venice's revenue model from VeniceStats.com. For 'what is Venice's revenue / annualized revenue / P/S today' answer with the 'Revenue today' block: subscribers still paying (rebuilt from every on-chain signup, decayed by monthly churn) + API credit purchases at today's pace + a constant off-chain term. It is a model, not reported revenue; never call it ARR. If that block says n/a, say it is not available: do not replace it with the projection. The second block is a what-if subscription projection (MRR/ARR of a base built from zero, 12 months of signups at today's pace) for scenarios on tier mix, churn and burn-to-revenue mapping. Also returns the annualised buyback budget per burn channel. NEVER frame the buyback figures as '% of revenue'. Same model as the Revenue Estimator at venicestats.com/burns. Pairs with venicestats_burn_stats_by_tier (observed mix, no modelling) and venicestats_discretionary_burn (the monthly TWAP). You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      tierMix: z
        .string()
        .default("observed")
        .describe(
          'Subscription tier mix. Default is "observed" — the live 30-day empirical mix from venicestats_burn_stats_by_tier. Other accepted values: preset names ("conservative", "standard", "optimistic") for what-if scenarios, or a comma-separated custom mix "pro,plus,max" in percent (e.g. "80,15,5"). If observed is requested but not available, falls back to the standard preset with a warning.',
        ),
      churn: z
        .number()
        .min(0)
        .max(100)
        .default(DEFAULT_CHURN_PCT)
        .describe("Monthly churn percentage, 0-100. Default 15, the value the site's estimator is calibrated at. Keep the default for revenue today."),
      burnModel: z
        .enum(["year-1-arr", "steady-state-12mo"])
        .default("steady-state-12mo")
        .describe(
          "Only for the projection block. year-1-arr (assumes every Pro Sub burn = one active sub for 12mo, no churn) or steady-state-12mo (applies churn over a 12-month horizon, more realistic).",
        ),
      horizonMonths: z
        .number()
        .int()
        .min(1)
        .max(120)
        .optional()
        .describe("Horizon of the projection block in months (default 12, max 120)."),
      includeDiscretionary: z
        .boolean()
        .default(true)
        .describe(
          "If true (default), the burn pace includes the discretionary (CoW-Swap TWAP) annual run-rate. If false, only Pro Sub and credits are listed.",
        ),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ tierMix, churn, burnModel, horizonMonths, includeDiscretionary }) => {
      try {
        const params: Record<string, string | number | undefined> = {
          tierMix,
          churn,
          burnModel,
          includeDiscretionary: String(includeDiscretionary),
        };
        if (horizonMonths !== undefined) params.horizonMonths = horizonMonths;

        const d = await apiGet<SimulatorOutput>("/api/simulate-revenue", params);
        const known = creditsKnown(d);

        const dist = d.inputs?.dist;
        const horizon = fmtCount(d.inputs?.horizonMonths);
        const modelLabel =
          d.inputs?.burnModel === "new-subs"
            ? "Year 1 ARR (no retention)"
            : `Steady-state (${fmtFixed(d.inputs?.churn, 0, "%")} monthly churn)`;
        const mix = `Pro ${fmtFixed(dist?.pro, 2, "%")} / Plus ${fmtFixed(dist?.plus, 2, "%")} / Max ${fmtFixed(dist?.max, 2, "%")}`;
        const mixSource =
          d.wasvSource === "observed"
            ? "observed 30d"
            : d.wasvSource === "explicit"
              ? "explicit"
              : d.wasvSource === "preset"
                ? tierMix.toLowerCase() === "observed" ? "preset, observed mix not available" : `${tierMix} preset`
                : "source n/a";

        // No signup rate means the API did not have one: what is built on it is not a zero.
        const rate = positive(d.dailyRate);
        const built = (v: unknown): number | null => (rate === null ? null : num(v));

        const lines: string[] = [
          `## Venice Revenue Model`,
          "",
          ...revenueTodayLines(d, known),
          `### Subscription projection (what-if: base built from zero, subscriptions only, NOT today's revenue)`,
          `Model: ${modelLabel} · Horizon: ${horizon}mo`,
          `Tier mix: ${mixSource} (${mix}) · weighted average ${fmtUsd(d.wasv)}/sub`,
          `Observed Pro Sub burn rate: ${fmtFixed(rate, 0)}/day → ${fmtToken(built(d.subsPerMonth))} subs/month`,
        ];
        const activeSubs = built(d.activeSubs);
        if (activeSubs !== null) {
          const steady = built(d.steadyState);
          lines.push(`Active subs at ${horizon}mo: ${fmtToken(activeSubs)}${steady !== null ? ` (steady-state: ${fmtToken(steady)})` : ""}`);
        }
        lines.push(`Projected MRR: ${fmtUsd(built(d.mrr))} · Projected ARR: ${fmtUsd(built(d.arr))}`, "");

        lines.push(...burnPaceLines(d, known, includeDiscretionary));

        const warnings = rows(d.warnings).map((w) => str(w)).filter((w) => w !== null);
        if (warnings.length > 0) lines.push(`### Warnings`, ...warnings.map((w) => `- ${w}`), "");

        lines.push(deepLinkLine("/burns"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/burns",
          tip: "Use venicestats_discretionary_burn for observed cycle data, or venicestats_burns_timeline for the historical bucket view. The interactive Revenue Estimator at /burns lets humans drag these inputs in real-time.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
