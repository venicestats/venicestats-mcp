import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
import { fmtToken, fmtUsd, fmtPct, fmtAgo } from "../lib/format.js";

interface LiveEvent {
  id: string;
  source: string;
  type: string;
  address: string;
  username: string | null;
  ensName: string | null;
  botLabel: string | null;
  amount: number;
  txHash: string;
  timestamp: string;
  pool: string | null;
}

interface LiveResponse {
  events: LiveEvent[];
  prices: {
    vvv: number;
    diem: number;
    vvvChange24h: number;
    diemChange24h: number;
    vvvVolume24h: number;
    diemVolume24h: number;
  };
  viewers: number;
}

const TYPE_LABELS: Record<string, string> = {
  buy: "🟢 BUY VVV",
  sell: "🔴 SELL VVV",
  buy_diem: "🟢 BUY DIEM",
  sell_diem: "🔴 SELL DIEM",
  stake: "📥 STAKE",
  unstake: "📤 UNSTAKE",
  claim: "🎁 CLAIM REWARDS",
  finalize: "✅ FINALIZE UNSTAKE",
  mint: "🔵 MINT DIEM",
  burn: "🔥 BURN",
};

export function registerLiveTool(server: McpServer) {
  server.tool(
    "venicestats_live",
    "Get a real-time feed of on-chain activity: swaps (buy/sell), staking events (stake, unstake, claim, finalize), DIEM events (mint, burn, stake), and vesting claims. Shows what is happening RIGHT NOW on Venice. Use when someone asks what's happening today, recent activity, or real-time events.",
    {
      limit: z.number().int().min(1).max(50).default(20).describe("Number of events to return (1-50, default 20)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ limit }) => {
      try {
        const d = await apiGet<LiveResponse>("/api/live", { limit });
        const p = d.prices;

        const lines = [
          `## Live Feed (${d.events.length} events)`,
          `VVV: ${fmtUsd(p.vvv)} (${fmtPct(p.vvvChange24h)}) | 24h Vol: ${fmtUsd(p.vvvVolume24h)}`,
          `DIEM: ${fmtUsd(p.diem)} (${fmtPct(p.diemChange24h)}) | 24h Vol: ${fmtUsd(p.diemVolume24h)}`,
          "",
        ];

        for (const e of d.events) {
          const label = TYPE_LABELS[e.type] || e.type.toUpperCase();
          const name = e.ensName || e.username || `${e.address.slice(0, 8)}...`;
          const bot = e.botLabel ? ` [${e.botLabel}]` : "";
          const token = e.source === "swap"
            ? (e.type.includes("diem") ? "DIEM" : "VVV")
            : (e.source === "diem" ? "DIEM" : "VVV");
          lines.push(`- ${label} ${fmtToken(e.amount, token)} by ${name}${bot} — ${fmtAgo(e.timestamp)}`);
        }

        return brandedResponse(lines.join("\n"), {
          deepLink: "/terminal",
          tip: "Use venicestats_large_trades for filtered large trades, or venicestats_wallet to look up any address.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
