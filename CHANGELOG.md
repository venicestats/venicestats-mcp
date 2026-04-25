# Changelog — @venicestats/mcp-server

All notable changes to this MCP server are documented here.

## [0.6.1] — 2026-04-25

### Fixed
- **`venice_models`** — Constraints line no longer renders as `[object Object]`. Helper `formatConstraintValue` now handles the four real shapes returned by Venice's `/api/v1/models`:
  - Dict with `min`/`max`/`default` keys (e.g. text models' `temperature: { default: 0.7 }`, image models' `steps: { default: 25, max: 30 }`) → formatted as `default 0.7` / `default 25, max 30` / `min–max (default X)` when `min` is present.
  - Arrays of strings (e.g. image `aspectRatios`, video `durations`/`resolutions`) → joined with `/`.
  - Primitives (string/int/bool, e.g. `promptCharacterLimit: 1500`) → stringified directly.
  - Unknown shapes → fallback to `JSON.stringify(v)` so something readable always renders.
- **`venice_models` `type=video`** — Was throwing `Cannot read properties of undefined (reading 'generation')` on every call because all 88 video models in Venice's current API ship without a `pricing` field. `formatPricing` and `priceSortKey` now guard against missing `pricing` (renders `See venice.ai for pricing`, sorts last). The TypeScript shape was tightened to `pricing?: Record<string, unknown>`.
- **Health check** now reports the correct version (was stuck at `0.5.0` since v0.6.0 ship).

### Notes — bundled v0.6.0 release notes (npm-only)
v0.6.0 was deployed to the HTTP server at `mcp.venicestats.com` on 2026-04-24 but never published to npm; users on `npx @venicestats/mcp-server` skip directly from `0.5.0` to `0.6.1` and pick up the v0.6.0 changes alongside the constraints fix:
- **`venice_models`** gained `sort` (`price` default | `recent` | `context`), `limit` (1–100), and an `Added to Venice` field on each result derived from the API's `created` timestamp. Use `sort=recent` for "newest LLMs" questions.
- **Grok ID fix**: `grok-4-20-beta` → `grok-4-20` (Venice dropped the `-beta` suffix; caught by VeniceStats' hourly catalog drift check).

## [0.5.0] — 2026-04-18

### Added — Buy-and-Burn Economy (3 new tools)
- **`venicestats_discretionary_burn`** — Current state of Venice's monthly CoW-Swap TWAP buy-and-burn cycle. Returns current-cycle progress (days elapsed, pace, slices executed, USDC spent), next-burn projection range (VVV/USD low/high with basis explanation), lifetime stats (total USDC spent, total VVV destroyed, value multiplier at current prices, cycles to date), and Safe wallet USDC balance with runway days.
- **`venicestats_simulate_revenue`** — Subscription revenue simulator. Models implied ARR from the observed Pro Sub programmatic burn rate ($1/new-subscription). Accepts tier mix (conservative/standard/optimistic), monthly churn (0-100), burn model (year-1-arr or steady-state-12mo), projection horizon, and discretionary-inclusion flag. Returns weighted avg subscription value, subs/month, MRR/ARR, market cap multiple, Pro Sub + discretionary annual burn pace, and burn coverage as % of simulated ARR. Identical math to the interactive Revenue Estimator at `/burns`.
- **`venicestats_burns_timeline`** — Aggregated bucket timeline of both burn channels (discretionary CoW-Swap TWAP + Pro Sub programmatic $1 burns). Returns daily/weekly/monthly buckets with VVV burned, USD-then (USDC paid), and USD-now (value at current price) per channel, plus all-time totals and an end-of-period projection for the current bucket.
- **Health check** now reports 24 tools and version 0.5.0.

### Changed
- Nothing removed or modified. Fully backward-compatible.

### Notes
- The three new tools pair — `venicestats_discretionary_burn` measures observed cycle flows, `venicestats_simulate_revenue` projects implied ARR against them, `venicestats_burns_timeline` provides the historical bucket view.
- All three are backed by `/api/discretionary-burn`, `/api/simulate-revenue`, `/api/burns-timeline` on venicestats.com.
- Zod schemas for `simulate_revenue` mirror the API's `resolveTierDist` and `normalizeBurnModel` validators — enum values match exactly.

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
