# Changelog — @venicestats/mcp-server

All notable changes to this MCP server are documented here.

## [0.4.0] — 2026-04-12

### Added
- **`venicestats_token_benchmarks`** — New tool for cross-token market comparisons across 63 AI/DePIN/Compute tokens. Returns real-time price, market cap, FDV, 24h volume, 1h/24h/7d/30d performance, ATH, rank, plus project metadata (chain, sector, description, key fact). Perfect for comparing Venice (VVV) against competitors like Bittensor (TAO), Render, Fetch.ai (FET), Akash (AKT), Virtuals, io.net, Aethir, etc.
  - Filter by symbol (`symbols=TAO,RENDER,FET`)
  - Filter by sector (`ai-inference`, `ai-agents`, `depin-infra`, `compute-gpu`, `macro-benchmark`)
  - Sort by market cap, 24h/7d/30d change, or volume
  - Returns project context (chain, year, rank, key fact) for small result sets
- **Health check** now reports 21 tools and version 0.4.0.

### Changed
- Nothing removed or modified. Fully backward-compatible.

### Notes
- Tool is backed by `/api/market-data` endpoint on venicestats.com, which fetches data from CoinGecko every 10 minutes and caches it locally.
- The VeniceStats `get_token_benchmarks` tool in Venice Intelligence (web chat) is the direct equivalent of this MCP tool.

## [0.3.0] — 2026-04-04

### Added
- Initial public release with 20 tools covering:
  - Core protocol (metrics, wallet, price, staking)
  - Trading intel (market volume, large trades, insider flow)
  - Tokenomics (treasury, airdrop, DIEM, vesting, burns)
  - Community (buzz, buzz metrics, social, leaderboard)
  - Wallet intel (wallet trades)
  - Real-time + historical (live feed, trends)
  - Venice ecosystem (venice_models)
