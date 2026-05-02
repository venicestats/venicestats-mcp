import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { CONFIG, INSTRUCTIONS } from "./config.js";
import { registerPriceTool } from "./tools/price.js";
import { registerStakingTool } from "./tools/staking.js";
import { registerMarketVolumeTool } from "./tools/market-volume.js";
import { registerWalletTool } from "./tools/wallet.js";
import { registerBurnsTool } from "./tools/burns.js";
import { registerProtocolOverviewTool } from "./tools/protocol-overview.js";
import { registerInsiderFlowTool } from "./tools/insider-flow.js";
import { registerLargeTradesTool } from "./tools/large-trades.js";
import { registerTreasuryTool } from "./tools/treasury.js";
import { registerAirdropTool } from "./tools/airdrop.js";
import { registerDiemTool } from "./tools/diem.js";
import { registerVestingTool } from "./tools/vesting.js";
import { registerBuzzTool } from "./tools/buzz.js";
import { registerBuzzMetricsTool } from "./tools/buzz-metrics.js";
import { registerSocialTool } from "./tools/social.js";
import { registerLeaderboardTool } from "./tools/leaderboard.js";
import { registerWalletTradesTool } from "./tools/wallet-trades.js";
import { registerLiveTool } from "./tools/live.js";
import { registerTrendsTool } from "./tools/trends.js";
import { registerModelsTool } from "./tools/models.js";
import { registerTokenBenchmarksTool } from "./tools/token-benchmarks.js";
import { registerDiscretionaryBurnTool } from "./tools/discretionary-burn.js";
import { registerSimulateRevenueTool } from "./tools/simulate-revenue.js";
import { registerBurnsTimelineTool } from "./tools/burns-timeline.js";
import { registerBurnStatsByTierTool } from "./tools/burn-stats-by-tier.js";

const TOOL_REGISTRARS: Array<(s: McpServer) => void> = [
  // Core
  registerPriceTool,
  registerStakingTool,
  registerMarketVolumeTool,
  registerWalletTool,
  registerBurnsTool,
  registerProtocolOverviewTool,

  // Trading Intel
  registerInsiderFlowTool,
  registerLargeTradesTool,

  // Tokenomics
  registerTreasuryTool,
  registerAirdropTool,
  registerDiemTool,
  registerVestingTool,

  // Community
  registerBuzzTool,
  registerBuzzMetricsTool,
  registerSocialTool,

  // Rankings + Wallet Intel
  registerLeaderboardTool,
  registerWalletTradesTool,

  // Real-time + Historical
  registerLiveTool,
  registerTrendsTool,

  // Venice Ecosystem
  registerModelsTool,

  // Cross-token Benchmarks (AI/DePIN/Compute)
  registerTokenBenchmarksTool,

  // Buy-and-Burn Economy
  registerDiscretionaryBurnTool,
  registerSimulateRevenueTool,
  registerBurnsTimelineTool,
  registerBurnStatsByTierTool,
];

export const TOOL_COUNT = TOOL_REGISTRARS.length;

export function createServer(): McpServer {
  const server = new McpServer(
    { name: CONFIG.name, version: CONFIG.version },
    { instructions: INSTRUCTIONS },
  );
  for (const register of TOOL_REGISTRARS) register(server);
  return server;
}
