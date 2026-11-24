import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { NA, changePct, fmtDate, fmtPct, num, rows, type Maybe } from "../lib/format.js";

const METRICS = [
  "vvvPrice", "diemPrice", "ethPrice",
  "stakingRatio", "totalStaked", "lockRatio", "svvvLocked",
  "diemSupply", "diemStaked", "diemStakeRatio",
  "mintRate", "cooldownWave",
] as const;

type MetricName = typeof METRICS[number];

interface DataPoint {
  t: number;
  v: number;
}

type ChartsResponse = Record<MetricName, DataPoint[]>;

const METRIC_LABELS: Record<MetricName, string> = {
  vvvPrice: "VVV Price (USD)",
  diemPrice: "DIEM Price (USD)",
  ethPrice: "ETH Price (USD)",
  stakingRatio: "Staking Ratio",
  totalStaked: "Total Staked (sVVV)",
  lockRatio: "Lock Ratio",
  svvvLocked: "sVVV Locked",
  diemSupply: "DIEM Supply",
  diemStaked: "DIEM Staked",
  diemStakeRatio: "DIEM Stake Ratio",
  mintRate: "DIEM Mint Rate (sVVV/DIEM)",
  cooldownWave: "Cooldown Wave (VVV)",
};

/** Points with both a date and a value. A gap is skipped, never read as zero. */
function knownPoints(series: Maybe<DataPoint[]>): DataPoint[] {
  return rows(series).flatMap((p) => {
    const t = num(p.t);
    const v = num(p.v);
    return t === null || v === null || fmtDate(t) === NA ? [] : [{ t, v }];
  });
}

const fmtValue = (v: number): string => v.toLocaleString("en-US", { maximumFractionDigits: 4 });

function summarizeSeries(points: DataPoint[], missing: number, label: string): string[] {
  const first = points[0];
  const last = points[points.length - 1];
  // Not Math.min(...values): a long series would not fit in the call's arguments.
  const min = points.reduce((m, p) => Math.min(m, p.v), Infinity);
  const max = points.reduce((m, p) => Math.max(m, p.v), -Infinity);

  const lines = [
    `## ${label} — Trend`,
    `Period: ${fmtDate(first.t)} → ${fmtDate(last.t)} (${points.length} data points${missing > 0 ? `, ${missing} without a value left out` : ""})`,
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Start | ${fmtValue(first.v)} |`,
    `| End | ${fmtValue(last.v)} |`,
    `| Change | ${fmtPct(points.length > 1 ? changePct(last.v, first.v) : null)} |`,
    `| Min | ${fmtValue(min)} |`,
    `| Max | ${fmtValue(max)} |`,
  ];

  // Sample evenly-spaced points for the LLM to see the shape, always with the last one
  const step = Math.max(1, Math.floor(points.length / Math.min(10, points.length)));
  const sampled = points.filter((_p, i) => i % step === 0 || i === points.length - 1);
  lines.push("", `### Sampled Values (${sampled.length} points)`);
  for (const p of sampled) lines.push(`- ${fmtDate(p.t)}: ${fmtValue(p.v)}`);

  return lines;
}

export function registerTrendsTool(server: McpServer) {
  server.tool(
    "venicestats_trends",
    `Returns historical trend data from VeniceStats.com — summary stats plus sampled data points. Available metrics: ${METRICS.join(", ")}. Use when someone asks about trends over time. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.`,
    {
      metric: z.enum(METRICS).describe(`Metric to chart. Options: ${METRICS.join(", ")}`),
      period: z.enum(["7d", "30d", "90d", "1y", "all"]).default("30d").describe("Lookback period"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ metric, period }) => {
      try {
        const data = await apiGet<ChartsResponse>("/api/charts", { period });
        const series = data[metric];
        const points = knownPoints(series);

        if (points.length === 0) {
          return brandedResponse(
            `No trend data available for "${metric}" in period "${period}".`,
            { deepLink: "/", tip: "Try a different period or metric." },
          );
        }

        const label = METRIC_LABELS[metric] || metric;
        const total = Array.isArray(series) ? series.length : points.length;
        const lines = summarizeSeries(points, total - points.length, label);

        lines.push("", deepLinkLine("/"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/",
          tip: `Available metrics: ${METRICS.join(", ")}. Use venicestats_protocol_overview for the latest snapshot values.`,
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
