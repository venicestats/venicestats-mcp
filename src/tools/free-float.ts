import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtFixed, fmtToken, fmtUsd, num, positive, sharePct, type Maybe } from "../lib/format.js";

interface MetricsResponse {
  vvvPrice: number;
  totalSupply: number;
  burnedSupply: number;
  totalStaked: number;
  vestingTotalLocked: number;
  freeFloatVvv: number | null;
  freeFloatVvvPctCirc: number | null;
  freeFloatVvvPctTotal: number | null;
  diemPrice: number;
  diemSupply: number;
  diemStaked: number;
  diemStakeRatio: number;
  freeFloatDiem: number | null;
  freeFloatDiemPct: number | null;
}

type Metrics = NonNullable<Maybe<MetricsResponse>>;

const pct = (v: unknown): string => fmtFixed(v, 2, "%");

function notional(amount: unknown, price: unknown): number | null {
  const a = num(amount);
  const p = positive(price);
  return a === null || p === null ? null : a * p;
}

// Free float is defined once, by the site: these read its fields and never recompute them.
function renderVvv(m: Metrics): string[] {
  const ofTotal = (part: unknown): string => pct(sharePct(part, m.totalSupply));
  return [
    "## VVV Free Float",
    "",
    `**Free Float**: ${fmtToken(m.freeFloatVvv, "VVV")} (≈ ${fmtUsd(notional(m.freeFloatVvv, m.vvvPrice))})`,
    `**% of Circulating**: ${pct(m.freeFloatVvvPctCirc)} — circulating VVV that is not staked`,
    `**% of Total Supply**: ${pct(m.freeFloatVvvPctTotal)}`,
    "",
    "**Supply decomposition** (% of Total Supply):",
    `- Total Supply: ${fmtToken(m.totalSupply)} VVV`,
    `- Burned: ${fmtToken(m.burnedSupply)} (${ofTotal(m.burnedSupply)}) — out forever`,
    `- Staked: ${fmtToken(m.totalStaked)} (${ofTotal(m.totalStaked)}) — sVVV; unstaking has a 7-day cooldown`,
    `- Vesting: ${fmtToken(m.vestingTotalLocked)} (${ofTotal(m.vestingTotalLocked)}) — still locked in vesting streams`,
    `- Free Float: ${fmtToken(m.freeFloatVvv)} (${pct(m.freeFloatVvvPctTotal)})`,
    "",
    "**Definition**: circulating supply minus staked VVV, as published by VeniceStats.",
  ];
}

function renderDiem(m: Metrics): string[] {
  const ratio = num(m.diemStakeRatio);
  return [
    "## DIEM Free Float",
    "",
    `**Free Float**: ${fmtToken(m.freeFloatDiem, "DIEM")} (≈ ${fmtUsd(notional(m.freeFloatDiem, m.diemPrice))})`,
    `**% of Supply**: ${pct(m.freeFloatDiemPct)} — DIEM not staked for inference capacity`,
    "",
    "**Supply breakdown**:",
    `- Total Supply: ${fmtToken(m.diemSupply)} DIEM`,
    `- Staked: ${fmtToken(m.diemStaked)} (${pct(ratio === null ? null : ratio * 100)}) — in use as inference capacity`,
    `- Free Float: ${fmtToken(m.freeFloatDiem)} (${pct(m.freeFloatDiemPct)})`,
    "",
    "**Definition**: DIEM supply minus staked DIEM, as published by VeniceStats.",
  ];
}

export function registerFreeFloatTool(server: McpServer) {
  server.tool(
    "venicestats_free_float",
    "Returns the current Free Float for VVV and/or DIEM from VeniceStats.com — the share of supply that is not staked and can trade right now. VVV: as % of circulating supply and of total supply, with a supply decomposition (burned, staked, vesting, free float). DIEM: supply not staked for inference capacity, as % of supply. Use this tool to answer 'how much VVV/DIEM is actually liquid?', 'what's the float-to-staked ratio?', or to compare the two tokens. The historical trajectory is plotted on /diem and /tokenomics. NEVER claim 'lower free float = bullish' as a hard rule. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      token: z
        .enum(["vvv", "diem", "both"])
        .optional()
        .describe("Which token's Free Float to return. Default: both."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ token }) => {
      try {
        const which = token ?? "both";
        const m = await apiGet<MetricsResponse>("/api/metrics");
        const lines: string[] = [];
        if (which === "vvv" || which === "both") {
          lines.push(...renderVvv(m));
          lines.push("");
        }
        if (which === "diem" || which === "both") {
          lines.push(...renderDiem(m));
          lines.push("");
        }
        const deep = which === "diem" ? "/diem" : "/tokenomics";
        lines.push(deepLinkLine(deep));
        return brandedResponse(lines.join("\n"), {
          deepLink: deep,
          tip: "Free Float trends over time are plotted on /diem (DIEM) and /tokenomics (VVV).",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
