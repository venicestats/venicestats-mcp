import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtUsd, fmtToken, fmtDate } from "../lib/format.js";

interface CurrentCycle {
  startTs: string;
  projectedBurnTs: string;
  daysElapsed: number;
  daysRemaining: number;
  slicesExecuted: number;
  vvvAccumulated: number;
  usdcSpentEstimated: number;
  twapStarts: number;
  pace: {
    slicesPerHour: number;
    vvvPerHour: number;
    usdcPerHour: number;
    regimeGuess: string;
  };
}

interface Projection {
  vvvLow: number;
  vvvHigh: number;
  usdLow: number;
  usdHigh: number;
  rangeConfidence: string;
  lowBasis: string;
  highBasis: string;
  highBasisKind: "budget" | "trend";
  vvvProjected: number;
  usdProjected: number;
  confidenceNote: string;
}

interface Lifetime {
  usdcSpent: number;
  vvvBurned: number;
  valueAtCurrentPrice: number;
  multiplier: number;
  cyclesCount: number;
}

interface SafeBalance {
  usdc: number;
  runwayDays: number | null;
}

interface DiscretionaryMeta {
  vvvPriceUsd: number;
  avgUsdcPerCycle?: number;
  avgUsdcCycleCount?: number;
  avgUsdAtBurnLast2?: number;
  now: string;
}

interface DiscretionarySummary {
  currentCycle: CurrentCycle | null;
  projection: Projection | null;
  lifetime?: Lifetime;
  safeBalance: SafeBalance;
  meta: DiscretionaryMeta;
}

export function registerDiscretionaryBurnTool(server: McpServer) {
  server.tool(
    "venicestats_discretionary_burn",
    "Returns the current state of Venice's discretionary buy-and-burn cycle from VeniceStats.com — the monthly CoW-Swap TWAP program that uses USDC to buy VVV and burn it. Shows current cycle pace (slices executed, USDC spent, VVV accumulated), projection range (low/high USD/VVV) for the next burn, lifetime stats (total USDC spent, total VVV destroyed, value multiplier at current prices), and the Safe wallet USDC balance with runway days. This is ONE of two on-chain burn streams; the other is the per-signup Pro Sub burn (tier-aware $2/$5/$10 since 2026-04-26 — see venicestats_burn_stats_by_tier and venicestats_simulate_revenue). Use for questions about the monthly burn cycle, projection of next burn size, or the cumulative deflation impact. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {},
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const d = await apiGet<DiscretionarySummary>("/api/discretionary-burn", {
          detail: "summary",
        });

        const lines: string[] = [`## Discretionary Buy-and-Burn — Current Cycle`, ""];

        if (!d.currentCycle || !d.projection) {
          lines.push("No active cycle data available yet.");
        } else {
          const c = d.currentCycle;
          const p = d.projection;

          lines.push(`### Cycle Progress`);
          lines.push(
            `Started: ${fmtDate(c.startTs)} — ${c.daysElapsed.toFixed(1)}d elapsed, ${c.daysRemaining.toFixed(1)}d to projected burn on ${fmtDate(c.projectedBurnTs)}`,
          );
          lines.push(`Regime: ${c.pace.regimeGuess}`);
          lines.push(
            `Pace: ${c.pace.slicesPerHour.toFixed(2)} slices/h · ${fmtToken(c.pace.vvvPerHour, "VVV")}/h · ${fmtUsd(c.pace.usdcPerHour)}/h`,
          );
          lines.push(
            `Accumulated so far: ${fmtToken(c.vvvAccumulated, "VVV")} queued to burn · ${fmtUsd(c.usdcSpentEstimated)} USDC spent (${c.slicesExecuted} slices)`,
          );
          lines.push("");

          lines.push(`### Projection for Next Burn`);
          lines.push(
            `VVV: ${fmtToken(p.vvvLow)} – ${fmtToken(p.vvvHigh)}`,
          );
          lines.push(
            `USD (at current VVV price): ${fmtUsd(p.usdLow)} – ${fmtUsd(p.usdHigh)}`,
          );
          lines.push(`Range confidence: ${p.rangeConfidence}`);
          lines.push(`Low basis: ${p.lowBasis}`);
          lines.push(`High basis: ${p.highBasis}`);
          lines.push("");
        }

        if (d.lifetime) {
          const l = d.lifetime;
          lines.push(`### Lifetime (${l.cyclesCount} cycles)`);
          lines.push(`Total USDC spent: ${fmtUsd(l.usdcSpent)}`);
          lines.push(`Total VVV burned: ${fmtToken(l.vvvBurned, "VVV")}`);
          lines.push(
            `Value at current price: ${fmtUsd(l.valueAtCurrentPrice)} (${l.multiplier.toFixed(2)}× multiplier)`,
          );
          lines.push("");
        }

        lines.push(`### Safe Wallet Balance`);
        lines.push(
          `USDC available: ${fmtUsd(d.safeBalance.usdc)}${
            d.safeBalance.runwayDays !== null
              ? ` · runway ${d.safeBalance.runwayDays.toFixed(1)}d at current pace`
              : ""
          }`,
        );
        if (d.meta.avgUsdcPerCycle) {
          lines.push(
            `Recent ${d.meta.avgUsdcCycleCount ?? 3}-cycle avg USDC spend: ${fmtUsd(d.meta.avgUsdcPerCycle)}`,
          );
        }
        lines.push("");
        lines.push(deepLinkLine("/burns"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/burns",
          tip: "Use venicestats_simulate_revenue to model Venice's subscription ARR against these observed burn flows, or venicestats_burns_timeline for the historical bucket view.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
