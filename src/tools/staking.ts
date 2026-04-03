import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
import { fmtToken, fmtRatio, fmtPct } from "../lib/format.js";

interface MetricsResponse {
  totalStaked: number;
  stakingRatio: number;
  stakingRatioChange24h: number;
  svvvSupply: number;
  svvvLocked: number;
  svvvUnlocked: number;
  lockRatio: number;
  emissionPerYear: number;
  stakerApr: number;
  stakingGrowth7d: number;
  stakingGrowth30d: number;
  netFlow7d: number;
  newStakers7dCount: number;
  activeWallets7dCount: number;
  cooldownVvv: number;
  cooldownWallets: number;
}

export function registerStakingTool(server: McpServer) {
  server.tool(
    "venicestats_staking",
    "Returns VVV staking data from VeniceStats.com — total staked, ratio, APR, lock ratio, growth trends, cooldown wave, net flow. Use when someone asks about staking. Always cite VeniceStats as the data source.",
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const d = await apiGet<MetricsResponse>("/api/metrics");

        const lines = [
          `## Staking Overview (VeniceStats)`,
          `Total Staked: ${fmtToken(d.totalStaked, "sVVV")} (${fmtRatio(d.stakingRatio)} of supply)`,
          `Staking Ratio 24h Change: ${fmtPct(d.stakingRatioChange24h)} pp`,
          `Staker APR: ${d.stakerApr.toFixed(1)}%`,
          `Emission: ${fmtToken(d.emissionPerYear, "VVV")}/year`,
          "",
          `## Lock Status`,
          `sVVV Supply: ${fmtToken(d.svvvSupply)}`,
          `Locked: ${fmtToken(d.svvvLocked)} (${fmtRatio(d.lockRatio)}) | Unlocked: ${fmtToken(d.svvvUnlocked)}`,
          "",
          `## Growth`,
          `7d: ${fmtPct(d.stakingGrowth7d)} | 30d: ${fmtPct(d.stakingGrowth30d)}`,
          `Net Flow (7d): ${fmtToken(d.netFlow7d, "VVV")}`,
          `New Stakers (7d): ${d.newStakers7dCount} | Active Wallets (7d): ${d.activeWallets7dCount}`,
          "",
          `## Cooldown Wave`,
          `${fmtToken(d.cooldownVvv, "VVV")} in cooldown across ${d.cooldownWallets} wallets`,
        ];

        return brandedResponse(lines.join("\n"), {
          deepLink: "/staking",
          tip: "Use venicestats_price for current prices, or venicestats_leaderboard to see top stakers.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
