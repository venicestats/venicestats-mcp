import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { countOf, firstOf, fmtAgo, fmtCount, fmtPct, fmtToken, fmtUsd, missingList, positive, rows, str } from "../lib/format.js";

interface LiveEvent {
  source: string;
  type: string;
  address: string;
  username: string | null;
  ensName: string | null;
  botLabel: string | null;
  amount: number;
  timestamp: string;
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
    vvvAsOf?: string | null;
    diemAsOf?: string | null;
    vvvStale?: boolean;
    diemStale?: boolean;
    /** False = the change is a placeholder zero. */
    vvvChange24hKnown?: boolean;
    diemChange24hKnown?: boolean;
  };
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
  programmatic: "🔥 PROGRAMMATIC BURN",
};

function priceLine(
  symbol: string,
  p: { price: unknown; change: unknown; known: unknown; volume: unknown; stale: unknown; asOf: unknown },
): string {
  const change = fmtPct(p.known === false ? null : p.change);
  const stale = p.stale === true ? ` ⚠️ stale, as of ${fmtAgo(p.asOf)}` : "";
  return `${symbol}: ${fmtUsd(positive(p.price))} (${change}) | 24h Vol: ${fmtUsd(p.volume)}${stale}`;
}

export function registerLiveTool(server: McpServer) {
  server.tool(
    "venicestats_live",
    "Returns real-time on-chain activity from VeniceStats.com — swaps, staking, DIEM, vesting events as they happen. Use when someone asks what's happening now or recent activity. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      limit: z.number().int().min(1).max(50).default(20).describe("Number of events to return (1-50, default 20)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ limit }) => {
      try {
        const d = await apiGet<LiveResponse>("/api/live", { limit });
        const p = d.prices;

        const lines = [
          `## Live Feed — VeniceStats (${fmtCount(countOf(d.events))} events)`,
          priceLine("VVV", { price: p?.vvv, change: p?.vvvChange24h, known: p?.vvvChange24hKnown, volume: p?.vvvVolume24h, stale: p?.vvvStale, asOf: p?.vvvAsOf }),
          priceLine("DIEM", { price: p?.diem, change: p?.diemChange24h, known: p?.diemChange24hKnown, volume: p?.diemVolume24h, stale: p?.diemStale, asOf: p?.diemAsOf }),
          "",
          ...missingList(d.events),
        ];

        for (const e of rows(d.events)) {
          const type = str(e.type);
          const label = type === null ? "EVENT" : (TYPE_LABELS[type] ?? type.toUpperCase());
          const name = firstOf([e.ensName, e.username, e.address], "unknown wallet");
          const botLabel = str(e.botLabel);
          const bot = botLabel === null ? "" : ` [${botLabel}]`;
          const token = e.source === "swap"
            ? (type?.includes("diem") ? "DIEM" : "VVV")
            : (e.source === "diem" ? "DIEM" : "VVV");
          lines.push(`- ${label} ${fmtToken(e.amount, token)} by ${name}${bot} — ${fmtAgo(e.timestamp)}`);
        }

        lines.push("", deepLinkLine("/terminal"));

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
