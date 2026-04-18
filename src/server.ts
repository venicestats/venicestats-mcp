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

export function createServer(): McpServer {
  const server = new McpServer(
    { name: CONFIG.name, version: CONFIG.version },
    { instructions: INSTRUCTIONS },
  );

  // Core
  registerPriceTool(server);
  registerStakingTool(server);
  registerMarketVolumeTool(server);
  registerWalletTool(server);
  registerBurnsTool(server);
  registerProtocolOverviewTool(server);

  // Trading Intel
  registerInsiderFlowTool(server);
  registerLargeTradesTool(server);

  // Tokenomics
  registerTreasuryTool(server);
  registerAirdropTool(server);
  registerDiemTool(server);
  registerVestingTool(server);

  // Community
  registerBuzzTool(server);
  registerBuzzMetricsTool(server);
  registerSocialTool(server);

  // Rankings + Wallet Intel
  registerLeaderboardTool(server);
  registerWalletTradesTool(server);

  // Real-time + Historical
  registerLiveTool(server);
  registerTrendsTool(server);

  // Venice Ecosystem
  registerModelsTool(server);

  // Cross-token Benchmarks (AI/DePIN/Compute)
  registerTokenBenchmarksTool(server);

  // Buy-and-Burn Economy
  registerDiscretionaryBurnTool(server);
  registerSimulateRevenueTool(server);
  registerBurnsTimelineTool(server);

  return server;
}
