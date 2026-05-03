import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtUsd, fmtToken } from "../lib/format.js";

interface MetricsResponse {
  vvvPrice: number;
  totalSupply: number;
  circulatingSupply: number;
  burnedSupply: number;
  totalStaked: number;
  vestingTotalLocked: number;
  diemPrice: number;
  diemSupply: number;
  diemStaked: number;
  diemStakeRatio: number;
}

function pct(part: number, whole: number): number {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function renderVvv(m: MetricsResponse): string[] {
  const freeFloat = m.circulatingSupply - m.totalStaked;
  const ffPctCirc = pct(freeFloat, m.circulatingSupply);
  const ffPctTotal = pct(freeFloat, m.totalSupply);
  const burnedPct = pct(m.burnedSupply, m.totalSupply);
  const stakedPct = pct(m.totalStaked, m.totalSupply);
  const vestingPct = pct(m.vestingTotalLocked, m.totalSupply);
  const notional = freeFloat * m.vvvPrice;
  return [
    "## VVV Free Float",
    "",
    `**Free Float**: ${fmtToken(freeFloat)} VVV (≈ ${fmtUsd(notional)})`,
    `**% of Circulating**: ${ffPctCirc.toFixed(2)}% — VVV in the open market not staked`,
    `**% of Total Supply**: ${ffPctTotal.toFixed(2)}% — including burned + vesting + treasury in denominator`,
    "",
    "**Supply decomposition** (% of Total Supply):",
    `- Total Supply: ${fmtToken(m.totalSupply)} VVV`,
    `- Burned: ${fmtToken(m.burnedSupply)} (${burnedPct.toFixed(2)}%) — out forever (buy-and-burn programme)`,
    `- Staked: ${fmtToken(m.totalStaked)} (${stakedPct.toFixed(2)}%) — locked as sVVV with 90-day cooldown`,
    `- Vesting: ${fmtToken(m.vestingTotalLocked)} (${vestingPct.toFixed(2)}%) — Sablier streams, dripping in slowly`,
    `- Free Float: ${fmtToken(freeFloat)} (${ffPctTotal.toFixed(2)}%) — actually tradable today`,
    "",
    "**Calculation**: `Free Float = circulatingSupply − totalStaked`. Uses canonical circulating supply (excludes treasury, vesting, team allocations) — comparable to CMC/CoinGecko methodology.",
  ];
}

function renderDiem(m: MetricsResponse): string[] {
  const freeFloat = m.diemSupply - m.diemStaked;
  const ffPctSupply = (1 - m.diemStakeRatio) * 100;
  const stakedPct = m.diemStakeRatio * 100;
  const notional = freeFloat * m.diemPrice;
  return [
    "## DIEM Free Float",
    "",
    `**Free Float**: ${fmtToken(freeFloat)} DIEM (≈ ${fmtUsd(notional)})`,
    `**% of Supply**: ${ffPctSupply.toFixed(2)}% — DIEM not staked for inference capacity`,
    "",
    "**Supply breakdown**:",
    `- Total Supply: ${fmtToken(m.diemSupply)} DIEM`,
    `- Staked: ${fmtToken(m.diemStaked)} (${stakedPct.toFixed(2)}%) — consumed as $1/day inference capacity, does not return to market`,
    `- Free Float: ${fmtToken(freeFloat)} (${ffPctSupply.toFixed(2)}%) — still tradable on Aerodrome VVV/DIEM pool`,
    "",
    "**Calculation**: `Free Float = diemSupply − diemStaked`. DIEM staked is consumed as inference capacity (not soft-locked like sVVV) — once staked, it powers Venice API calls and never returns to the open market.",
  ];
}

export function registerFreeFloatTool(server: McpServer) {
  server.tool(
    "venicestats_free_float",
    "Returns the current Free Float for VVV and/or DIEM from VeniceStats.com — the share of supply actually tradable in the open market right now. For VVV: Free Float = circulatingSupply − totalStaked, expressed as % of canonical circulating supply (CMC/CG-comparable) and also as % of total supply. Includes a full supply decomposition: Burned (out forever, ~30%), Staked (locked sVVV with 90d cooldown, ~28%), Vesting (Sablier streams dripping in, ~4%), Free Float (~13%). For DIEM: Free Float = diemSupply − diemStaked, expressed as % of supply. DIEM staked is consumed as inference capacity (not soft-locked like sVVV) — once staked it powers Venice API calls and never returns to market. Use this tool to answer 'how much VVV/DIEM is actually liquid?', 'what's the float-to-staked ratio?', 'is supply scarcity increasing?', or to compare the two tokens' free float dynamics. The historical trajectory (DIEM Free Float fell from 100% to ~22% in 8 months; VVV from ~97% to ~31% in 16 months) is plotted on /diem and /tokenomics respectively. NEVER claim 'lower free float = bullish' as a hard rule — for DIEM it reflects real demand consumption (compute paid for); for VVV it reflects soft-lock + burn. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
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
          tip: "Free Float trends over time are plotted on /diem (DIEM) and /tokenomics (VVV) — both with adaptive Y axis: zoomed for short periods, anchored at 0 for 1y/ALL to show the historical fall.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
