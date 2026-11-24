import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtCount, fmtFixed, fmtPct, fmtPp, fmtRatio, fmtToken } from "../lib/format.js";

interface MetricsResponse {
  totalStaked: number;
  stakingRatio: number | null;
  stakingRatioChange24h: number | null;
  svvvSupply: number;
  svvvLocked: number;
  svvvUnlocked: number;
  lockRatio: number;
  emissionPerYear: number;
  stakerApr: number | null;
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
    "Returns VVV staking data from VeniceStats.com — total staked, ratio, APR, lock ratio, growth trends, cooldown wave, net flow. Use when someone asks about staking. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const d = await apiGet<MetricsResponse>("/api/metrics");

        const lines = [
          `## Staking Overview (VeniceStats)`,
          `Total Staked: ${fmtToken(d.totalStaked, "sVVV")}`,
          `Staking Ratio: ${fmtRatio(d.stakingRatio)} (24h change: ${fmtPp(d.stakingRatioChange24h)})`,
          `Staker APR: ${fmtFixed(d.stakerApr, 1, "%")}`,
          `Emission: ${fmtToken(d.emissionPerYear, "VVV")}/year`,
          "",
          `## Lock Status`,
          `sVVV Supply: ${fmtToken(d.svvvSupply)}`,
          `Locked: ${fmtToken(d.svvvLocked)} (${fmtRatio(d.lockRatio)}) | Unlocked: ${fmtToken(d.svvvUnlocked)}`,
          "",
          `## Growth`,
          `7d: ${fmtPct(d.stakingGrowth7d)} | 30d: ${fmtPct(d.stakingGrowth30d)}`,
          `Net Flow (7d): ${fmtToken(d.netFlow7d, "VVV")}`,
          `New Stakers (7d): ${fmtCount(d.newStakers7dCount)} | Active Wallets (7d): ${fmtCount(d.activeWallets7dCount)}`,
          "",
          `## Cooldown Wave`,
          `${fmtToken(d.cooldownVvv, "VVV")} in cooldown across ${fmtCount(d.cooldownWallets)} wallets`,
          "",
          deepLinkLine("/staking"),
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
