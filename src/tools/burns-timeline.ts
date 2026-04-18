import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtUsd, fmtToken } from "../lib/format.js";

interface Bucket {
  t: number;
  discUsdThen: number;
  discUsdNow: number;
  discVvv: number;
  proSubUsdThen: number;
  proSubUsdNow: number;
  proSubVvv: number;
}

interface Totals {
  discUsdThen: number;
  discUsdNow: number;
  discVvv: number;
  proSubUsdThen: number;
  proSubUsdNow: number;
  proSubVvv: number;
}

interface StreamProjection {
  usdcSpent: number;
  usdNow: number;
  vvv: number;
}

interface BurnsTimelineResponse {
  granularity: "daily" | "weekly" | "monthly";
  range: "30d" | "90d" | "all";
  buckets: Bucket[];
  currentBucketProjection: {
    bucketT: number;
    discProjected: StreamProjection;
    proSubProjected: StreamProjection;
  } | null;
  totals: Totals;
  meta: {
    vvvPriceNow: number;
    startTs: number | null;
    endTs: number | null;
  };
}

function fmtBucketDate(t: number, gran: "daily" | "weekly" | "monthly"): string {
  const d = new Date(t);
  const iso = d.toISOString().slice(0, 10);
  if (gran === "monthly") return iso.slice(0, 7);
  return iso;
}

export function registerBurnsTimelineTool(server: McpServer) {
  server.tool(
    "venicestats_burns_timeline",
    "Returns the aggregated Venice buy-and-burn timeline from VeniceStats.com — historical buckets (daily/weekly/monthly) that combine both burn channels: discretionary (CoW-Swap TWAP monthly cycle, continuous since Nov 2025) and Pro Sub ($1-per-new-subscription programmatic, since 2026-04-12). Each bucket reports VVV burned plus two USD modes: USD-then (USDC paid at the time) and USD-now (VVV value at current price, to show destroyed value at today's marks). Also returns all-time totals across both channels and a current-bucket projection when available. Use for questions about historical burn volume trends, month-over-month pace, the relative contribution of each channel, or 'how much has Venice burned this month/quarter/since launch?'. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      granularity: z
        .enum(["daily", "weekly", "monthly"])
        .default("daily")
        .describe("Bucket size for the timeline (default daily)."),
      range: z
        .enum(["30d", "90d", "all"])
        .default("90d")
        .describe(
          "Date range for buckets returned (default 90d). All-time totals are returned regardless of this filter.",
        ),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .default(30)
        .describe("Maximum buckets to include in the output table (most recent first)."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ granularity, range, limit }) => {
      try {
        const d = await apiGet<BurnsTimelineResponse>("/api/burns-timeline", {
          granularity,
          range,
        });

        const recent = d.buckets.slice(-limit);
        const lines: string[] = [
          `## Venice Burns Timeline — ${granularity} (${range})`,
          `Showing ${recent.length} most recent of ${d.buckets.length} buckets.`,
          "",
        ];

        lines.push(`### All-time Totals (both channels)`);
        lines.push(
          `Discretionary: ${fmtToken(d.totals.discVvv, "VVV")} burned · ${fmtUsd(d.totals.discUsdThen)} USDC paid · ${fmtUsd(d.totals.discUsdNow)} at current price`,
        );
        lines.push(
          `Pro Sub: ${fmtToken(d.totals.proSubVvv, "VVV")} burned · ${fmtUsd(d.totals.proSubUsdThen)} at-time · ${fmtUsd(d.totals.proSubUsdNow)} at current price`,
        );
        const combinedVvv = d.totals.discVvv + d.totals.proSubVvv;
        const combinedUsdNow = d.totals.discUsdNow + d.totals.proSubUsdNow;
        lines.push(
          `Combined: ${fmtToken(combinedVvv, "VVV")} destroyed · worth ${fmtUsd(combinedUsdNow)} at current price`,
        );
        lines.push("");

        if (recent.length > 0) {
          lines.push(`### Buckets`);
          lines.push(`| Period | Disc VVV | Disc USD (then) | Pro Sub VVV | Pro Sub count | Combined USD (now) |`);
          lines.push(`|--------|----------|-----------------|-------------|---------------|--------------------|`);
          for (const b of recent) {
            const combined = b.discUsdNow + b.proSubUsdNow;
            lines.push(
              `| ${fmtBucketDate(b.t, granularity)} | ${fmtToken(b.discVvv)} | ${fmtUsd(b.discUsdThen)} | ${fmtToken(b.proSubVvv)} | ${Math.round(b.proSubUsdThen)} | ${fmtUsd(combined)} |`,
            );
          }
          lines.push("");
        }

        if (d.currentBucketProjection) {
          const disc = d.currentBucketProjection.discProjected;
          const pro = d.currentBucketProjection.proSubProjected;
          lines.push(`### Current bucket projection (end-of-period)`);
          lines.push(
            `Discretionary projected: ${fmtToken(disc.vvv, "VVV")} · ${fmtUsd(disc.usdcSpent)} USDC · ${fmtUsd(disc.usdNow)} at current price`,
          );
          lines.push(
            `Pro Sub projected: ${fmtToken(pro.vvv, "VVV")} · ${Math.round(pro.usdcSpent)} burns (~${fmtUsd(pro.usdNow)} at current price)`,
          );
          lines.push("");
        }

        lines.push(deepLinkLine("/burns"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/burns",
          tip: "Use venicestats_discretionary_burn for live cycle detail or venicestats_simulate_revenue to model burn coverage against implied ARR.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
