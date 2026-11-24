import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtCount, fmtDate, fmtFixed, fmtToken, fmtUsd, num, positive, text } from "../lib/format.js";

interface CurrentCycle {
  startTs: string;
  projectedBurnTs: string;
  daysElapsed: number;
  daysRemaining: number;
  slicesExecuted: number;
  vvvAccumulated: number;
  usdcSpentEstimated: number;
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
}

interface Lifetime {
  usdcSpent: number;
  vvvBurned: number;
  valueAtCurrentPrice: number;
  multiplier: number;
  cyclesCount: number;
}

interface SafeBalance {
  /** Null when the balance could not be read. */
  usdc: number | null;
  runwayDays: number | null;
}

interface DiscretionarySummary {
  currentCycle: CurrentCycle | null;
  projection: Projection | null;
  lifetime?: Lifetime;
  safeBalance: SafeBalance;
  meta: {
    vvvPriceUsd: number;
    avgUsdcPerCycle?: number;
    avgUsdcCycleCount?: number;
  };
}

export function registerDiscretionaryBurnTool(server: McpServer) {
  server.tool(
    "venicestats_discretionary_burn",
    "Returns the current state of Venice's discretionary buy-and-burn cycle from VeniceStats.com — the monthly CoW-Swap TWAP program that uses USDC to buy VVV and burn it. Shows current cycle pace (slices executed, USDC spent, VVV accumulated), projection range (low/high USD/VVV) for the next burn, lifetime stats (total USDC spent, total VVV destroyed, value multiplier at current prices), and the Safe wallet USDC balance with runway days. This is one of the on-chain burn channels; see venicestats_burns_timeline for all of them and venicestats_burn_stats_by_tier for the per-signup Pro Sub burns. Use for questions about the monthly burn cycle, projection of next burn size, or the cumulative deflation impact. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {},
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const d = await apiGet<DiscretionarySummary>("/api/discretionary-burn", {
          detail: "summary",
        });

        const lines: string[] = [`## Discretionary Buy-and-Burn — Current Cycle`, ""];
        const c = d.currentCycle;
        const p = d.projection;

        if (!c) {
          lines.push("No active cycle data available right now.", "");
        } else {
          lines.push(`### Cycle Progress`);
          lines.push(
            `Started: ${fmtDate(c.startTs)} — ${fmtFixed(c.daysElapsed, 1, "d")} elapsed, ${fmtFixed(c.daysRemaining, 1, "d")} to projected burn on ${fmtDate(c.projectedBurnTs)}`,
          );
          lines.push(`Regime: ${text(c.pace?.regimeGuess)}`);
          lines.push(
            `Pace: ${fmtFixed(c.pace?.slicesPerHour, 2)} slices/h · ${fmtToken(c.pace?.vvvPerHour, "VVV")}/h · ${fmtUsd(c.pace?.usdcPerHour)}/h`,
          );
          lines.push(
            `Accumulated so far: ${fmtToken(c.vvvAccumulated, "VVV")} queued to burn · ${fmtUsd(c.usdcSpentEstimated)} USDC spent (${fmtCount(c.slicesExecuted)} slices)`,
          );
          lines.push("");
        }

        if (p) {
          lines.push(`### Projection for Next Burn`);
          lines.push(`VVV: ${fmtToken(p.vvvLow)} – ${fmtToken(p.vvvHigh)}`);
          lines.push(`USD (at current VVV price): ${fmtUsd(p.usdLow)} – ${fmtUsd(p.usdHigh)}`);
          lines.push(`Range confidence: ${text(p.rangeConfidence)}`);
          lines.push(`Low basis: ${text(p.lowBasis)}`);
          lines.push(`High basis: ${text(p.highBasis)}`);
          lines.push("");
        } else if (c) {
          lines.push(`### Projection for Next Burn`, "No projection available right now.", "");
        }

        if (d.lifetime) {
          const l = d.lifetime;
          // Without a price the API's "at current price" figures are not a value.
          const priced = positive(d.meta?.vvvPriceUsd) !== null;
          lines.push(`### Lifetime (${fmtCount(l.cyclesCount)} cycles)`);
          lines.push(`Total USDC spent: ${fmtUsd(l.usdcSpent)}`);
          lines.push(`Total VVV burned: ${fmtToken(l.vvvBurned, "VVV")}`);
          lines.push(
            `Value at current price: ${fmtUsd(priced ? l.valueAtCurrentPrice : null)} (${fmtFixed(priced ? l.multiplier : null, 2, "×")} multiplier)`,
          );
          lines.push("");
        }

        const runway = num(d.safeBalance?.runwayDays);
        lines.push(`### Safe Wallet Balance`);
        lines.push(
          `USDC available: ${fmtUsd(d.safeBalance?.usdc)}${runway !== null ? ` · runway ${runway.toFixed(1)}d at current pace` : ""}`,
        );
        const avg = positive(d.meta?.avgUsdcPerCycle);
        if (avg !== null) {
          const cycles = positive(d.meta?.avgUsdcCycleCount);
          lines.push(`Recent ${cycles === null ? "" : `${cycles}-`}cycle avg USDC spend: ${fmtUsd(avg)}`);
        }
        lines.push("");
        lines.push(deepLinkLine("/burns"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/burns",
          tip: "Use venicestats_burns_timeline for the historical view across burn channels, or venicestats_simulate_revenue for modeled revenue.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
