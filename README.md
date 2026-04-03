# @venicestats/mcp-server

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

MCP server for [VeniceStats](https://venicestats.com) — real-time on-chain analytics for Venice.ai (VVV/DIEM tokens on Base chain). Exposes 18 tools that any MCP-compatible client (Claude Desktop, Cursor, etc.) can call to get live protocol data, trading intelligence, wallet profiles, and more.

## Quick Start

### Option A: stdio (Claude Desktop / Cursor)

```bash
npx @venicestats/mcp-server
```

### Option B: HTTP (self-hosted)

```bash
npx @venicestats/mcp-server --http
# Listening on port 3333 (override with PORT env var)
```

## Claude Desktop Configuration

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "venicestats": {
      "command": "npx",
      "args": ["@venicestats/mcp-server"]
    }
  }
}
```

Then ask Claude: *"What's the current VVV price?"* or *"Who are the top Venice stakers?"*

## Cursor Configuration

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "venicestats": {
      "command": "npx",
      "args": ["@venicestats/mcp-server"]
    }
  }
}
```

## Tools (18)

### Core
| Tool | Description |
|------|-------------|
| `venicestats_price` | VVV and DIEM prices, 24h change, market cap, FDV |
| `venicestats_staking` | Staking ratio, APR, lock status, growth, cooldown wave |
| `venicestats_market_volume` | DEX trading volume by pool, buy/sell ratio, trader count |
| `venicestats_wallet` | Full wallet profile: role, era, size, badges, radar, chronicle |
| `venicestats_burns` | Recent VVV burn events with categories and ENS names |
| `venicestats_protocol_overview` | Comprehensive protocol snapshot (40+ KPIs, filterable by category) |

### Trading Intelligence
| Tool | Description |
|------|-------------|
| `venicestats_insider_flow` | Vesting recipient (insider) trading activity and retention |
| `venicestats_large_trades` | Individual large swaps with trader identity and insider flag |

### Tokenomics
| Tool | Description |
|------|-------------|
| `venicestats_treasury` | Treasury balances by category (treasury, incentive, staking, liquidity) |
| `venicestats_airdrop` | Airdrop distribution, retention rate, loyalist analysis |
| `venicestats_diem` | DIEM minting cohorts, top minters, burn rates, Venice revenue |
| `venicestats_vesting` | Vesting schedules, daily drip rate, cliffs, fully-vested date |

### Community
| Tool | Description |
|------|-------------|
| `venicestats_buzz` | Recent articles, tweets, and videos about Venice.ai |
| `venicestats_social` | Twitter followers, CoinGecko sentiment, social volume (coming soon) |

### Rankings & Wallet Intel
| Tool | Description |
|------|-------------|
| `venicestats_leaderboard` | Top holders by sVVV, DIEM, conviction, or locked amount |
| `venicestats_wallet_trades` | Wallet trading history, cost basis, PnL, behavioral insights |

### Real-time & Historical
| Tool | Description |
|------|-------------|
| `venicestats_live` | Real-time on-chain feed: swaps, stakes, mints, claims |
| `venicestats_trends` | Historical trend data with summary stats and sampled points |

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `VENICESTATS_API_URL` | `https://venicestats.com` | API base URL |
| `PORT` | `3333` | HTTP transport port (--http mode only) |

## Links

- [VeniceStats](https://venicestats.com) — Live dashboard
- [Venice.ai](https://venice.ai) — Privacy-focused AI platform
- [@venicestats](https://x.com/venicestats) — Project updates
- [@gekko_eth](https://x.com/gekko_eth) — Built by gekko.eth

## License

[MIT](LICENSE)
