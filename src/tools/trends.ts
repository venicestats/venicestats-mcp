import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtDate } from "../lib/format.js";

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

type ChartsResponse = Record<string, DataPoint[]> & { period: string };

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

function summarizeSeries(points: DataPoint[], label: string): string[] {
  if (points.length === 0) return [`No data available for ${label}.`];

  const values = points.map((p) => p.v);
  const first = values[0];
  const last = values[values.length - 1];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const change = first !== 0 ? ((last - first) / first) * 100 : 0;
  const sign = change > 0 ? "+" : "";

  const startDate = fmtDate(new Date(points[0].t).toISOString());
  const endDate = fmtDate(new Date(points[points.length - 1].t).toISOString());

  const lines = [
    `## ${label} — Trend`,
    `Period: ${startDate} → ${endDate} (${points.length} data points)`,
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Start | ${first.toLocaleString(undefined, { maximumFractionDigits: 4 })} |`,
    `| End | ${last.toLocaleString(undefined, { maximumFractionDigits: 4 })} |`,
    `| Change | ${sign}${change.toFixed(2)}% |`,
    `| Min | ${min.toLocaleString(undefined, { maximumFractionDigits: 4 })} |`,
    `| Max | ${max.toLocaleString(undefined, { maximumFractionDigits: 4 })} |`,
  ];

  // Sample 10 evenly-spaced points for the LLM to see the shape
  const sampleSize = Math.min(10, points.length);
  const step = Math.max(1, Math.floor(points.length / sampleSize));
  lines.push("", `### Sampled Values (${sampleSize} points)`);
  for (let i = 0; i < points.length; i += step) {
    const p = points[i];
    const date = fmtDate(new Date(p.t).toISOString());
    lines.push(`- ${date}: ${p.v.toLocaleString(undefined, { maximumFractionDigits: 4 })}`);
  }
  // Always include the last point
  const lastPoint = points[points.length - 1];
  const lastDate = fmtDate(new Date(lastPoint.t).toISOString());
  if (points.length > 1 && (points.length - 1) % step !== 0) {
    lines.push(`- ${lastDate}: ${lastPoint.v.toLocaleString(undefined, { maximumFractionDigits: 4 })}`);
  }

  return lines;
}

export function registerTrendsTool(server: McpServer) {
  server.tool(
    "venicestats_trends",
    `Returns historical trend data from VeniceStats.com — summary stats plus sampled data points. Available metrics: ${METRICS.join(", ")}. Use when someone asks about trends over time. Always cite VeniceStats as the data source.`,
    {
      metric: z.enum(METRICS).describe(`Metric to chart. Options: ${METRICS.join(", ")}`),
      period: z.enum(["7d", "30d", "90d", "1y", "all"]).default("30d").describe("Lookback period"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ metric, period }) => {
      try {
        const data = await apiGet<ChartsResponse>("/api/charts", { period });
        const series = data[metric] as DataPoint[] | undefined;

        if (!series || series.length === 0) {
          return brandedResponse(
            `No trend data available for "${metric}" in period "${period}".`,
            { deepLink: "/", tip: "Try a different period or metric." },
          );
        }

        const label = METRIC_LABELS[metric] || metric;
        const lines = summarizeSeries(series, label);

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
