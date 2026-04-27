import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtUsd, fmtToken } from "../lib/format.js";

interface SimulatorOutput {
  inputs: {
    dist: { pro: number; plus: number; max: number };
    burnModel: "new-subs" | "all-billing";
    churn: number;
    horizonMonths: number;
    includeDiscretionary?: boolean;
  };
  wasv: number;
  dailyRate: number;
  subsPerMonth: number;
  activeSubs: number | null;
  steadyState: number | null;
  mrr: number;
  arr: number;
  pe: number;
  proSubAnnualUsd: number;
  discretionaryAnnualRunRate: number | null;
  totalBurnPacePerYear: number;
  burnsPctProSubArr: number;
  narrative: string;
  warnings: string[];
  presets?: Record<string, { label: string; dist: { pro: number; plus: number; max: number }; desc: string }>;
  source?: {
    metricsFetched: boolean;
    discretionaryFetched: boolean;
    upstreamTimeoutMs: number;
  };
}

export function registerSimulateRevenueTool(server: McpServer) {
  server.tool(
    "venicestats_simulate_revenue",
    "Runs Venice's subscription revenue simulator from VeniceStats.com — models implied Pro subscription MRR/ARR from the observed on-chain Pro Sub burn rate. Each new Venice subscription triggers a tier-aware programmatic burn ($2 for Pro / $5 for Pro+ / $10 for Max — confirmed on-chain since 2026-04-26 16:36 UTC; pre-flip events were a flat ~$1). Inputs: tier distribution preset (Pro $18 / Plus $68 / Max $200), monthly churn, burn-to-revenue mapping. Outputs: weighted average subscription value (WASV), subs/month, active subs at 12mo, MRR, ARR, and a buyback-budget summary (Pro Sub + discretionary) annualised. NEVER frame the buyback figure as '% of revenue' — it is buyback flow, not subscription revenue. Pairs with venicestats_burn_stats_by_tier (empirical observed mix, no modelling) and venicestats_discretionary_burn (the monthly TWAP). Identical math to the interactive Revenue Estimator at venicestats.com/burns. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      tierMix: z
        .enum(["conservative", "standard", "optimistic"])
        .default("standard")
        .describe(
          "Subscription tier mix preset: conservative (85/12/3 Pro/Plus/Max), standard (70/22/8), or optimistic (50/30/20).",
        ),
      churn: z
        .number()
        .min(0)
        .max(100)
        .default(5)
        .describe("Monthly churn percentage, 0-100. Typical consumer SaaS: 3-8. Default 5."),
      burnModel: z
        .enum(["year-1-arr", "steady-state-12mo"])
        .default("steady-state-12mo")
        .describe(
          "Burn-to-revenue mapping: year-1-arr (assumes every Pro Sub burn = one active sub for 12mo, no churn) or steady-state-12mo (applies churn over a 12-month horizon, more realistic).",
        ),
      horizonMonths: z
        .number()
        .int()
        .min(1)
        .max(120)
        .optional()
        .describe("Projection horizon in months (default 12, max 120)."),
      includeDiscretionary: z
        .boolean()
        .default(true)
        .describe(
          "If true (default), adds the discretionary (CoW-Swap TWAP) annual run-rate to the burn coverage total. If false, reports only the Pro Sub channel.",
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

        const dist = d.inputs.dist;
        const horizon = d.inputs.horizonMonths;
        const modelLabel =
          d.inputs.burnModel === "new-subs"
            ? "Year 1 ARR (no retention)"
            : `Steady-state 12mo (${d.inputs.churn}% monthly churn)`;

        const lines: string[] = [
          `## Venice Revenue Simulation`,
          `Model: ${modelLabel}`,
          `Tier mix: ${tierMix} (Pro ${dist.pro}% / Plus ${dist.plus}% / Max ${dist.max}%)`,
          `Horizon: ${horizon}mo · WASV ${fmtUsd(d.wasv)}/sub`,
          "",
          `### Subscription Projection`,
          `Observed Pro Sub burn rate: ${d.dailyRate.toFixed(0)}/day → ${fmtToken(d.subsPerMonth)} subs/month`,
        ];
        if (d.activeSubs !== null) {
          lines.push(
            `Active subs at ${horizon}mo: ${fmtToken(d.activeSubs)}${
              d.steadyState !== null ? ` (steady-state: ${fmtToken(d.steadyState)})` : ""
            }`,
          );
        }
        lines.push(`MRR: ${fmtUsd(d.mrr)} · ARR: ${fmtUsd(d.arr)}`);
        lines.push(`Market cap / ARR ratio: ${d.pe > 0 ? `${d.pe.toFixed(1)}×` : "n/a"}`);
        lines.push("");

        lines.push(`### Burn Coverage`);
        lines.push(`Pro Sub burn pace (annualised): ${fmtUsd(d.proSubAnnualUsd)}`);
        if (d.discretionaryAnnualRunRate !== null) {
          lines.push(
            `Discretionary burn pace (annualised): ${fmtUsd(d.discretionaryAnnualRunRate)}`,
          );
        }
        lines.push(`Combined burn pace / year: ${fmtUsd(d.totalBurnPacePerYear)}`);
        lines.push(
          `Burns as % of simulated ARR: ${d.burnsPctProSubArr.toFixed(1)}%`,
        );
        lines.push("");

        lines.push(`### Narrative`);
        lines.push(d.narrative);

        if (d.warnings.length > 0) {
          lines.push("");
          lines.push(`### Warnings`);
          for (const w of d.warnings) {
            lines.push(`- ${w}`);
          }
        }

        lines.push("");
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
