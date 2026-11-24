import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { NA, countOf, fmtCount, fmtDate, fmtToken, fmtUsd, positive, rows, sumAll } from "../lib/format.js";

interface Channels {
  discUsdThen: number;
  discUsdNow: number;
  discVvv: number;
  proSubUsdThen: number;
  proSubUsdNow: number;
  proSubVvv: number;
  proSubCount: number;
  creditsUsdThen: number;
  creditsUsdNow: number;
  creditsVvv: number;
  creditsCount: number;
}

interface Bucket extends Channels {
  t: number;
}

interface StreamProjection {
  usdcSpent: number;
  usdNow: number;
  vvv: number;
}

interface BurnsTimelineResponse {
  buckets: Bucket[];
  /** What is still to come in the bucket in progress, on top of what it already has. */
  currentBucketProjection: {
    discProjected: StreamProjection;
    proSubProjected: StreamProjection;
  } | null;
  creditsProjection: StreamProjection | null;
  totals: Channels;
  meta: {
    vvvPriceNow: number;
  };
}

function fmtBucketDate(t: unknown, gran: "daily" | "weekly" | "monthly"): string {
  const iso = fmtDate(t);
  return gran === "monthly" && iso !== NA ? iso.slice(0, 7) : iso;
}

export function registerBurnsTimelineTool(server: McpServer) {
  server.tool(
    "venicestats_burns_timeline",
    "Returns the aggregated Venice buy-and-burn timeline from VeniceStats.com — historical buckets (daily/weekly/monthly) per burn channel: discretionary (CoW-Swap TWAP monthly cycle), Pro Sub (programmatic buyback on each new subscription) and credits (programmatic buyback on API credit purchases). Each bucket reports VVV plus two USD modes: USD-then (USDC paid at the time) and USD-now (VVV value at current price). Also returns all-time totals and a projection of what is still to come in the current bucket when available. Use for questions about historical burn volume trends, month-over-month pace, the relative contribution of each channel, or 'how much has Venice burned this month/quarter/since launch?'. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
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
        .describe("Maximum buckets to include in the output table (the most recent ones)."),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ granularity, range, limit }) => {
      try {
        const d = await apiGet<BurnsTimelineResponse>("/api/burns-timeline", {
          granularity,
          range,
        });

        // "At current price" needs a price: the API multiplies by 0 when it has none.
        const priced = positive(d.meta?.vvvPriceNow) !== null;
        const usdNow = (v: unknown): string => (priced ? fmtUsd(v) : NA);

        const buckets = rows(d.buckets);
        const recent = buckets.slice(-limit);
        const t = d.totals;
        const lines: string[] = [
          `## Venice Burns Timeline — ${granularity} (${range})`,
          `Showing ${countOf(d.buckets) === null ? NA : recent.length} most recent of ${fmtCount(countOf(d.buckets))} buckets.`,
          "",
          `### All-time Totals`,
          `Discretionary: ${fmtToken(t?.discVvv, "VVV")} bought (burned once a month, so part may still be queued) · ${fmtUsd(t?.discUsdThen)} USDC paid · ${usdNow(t?.discUsdNow)} at current price`,
          `Pro Sub: ${fmtToken(t?.proSubVvv, "VVV")} burned in ${fmtCount(t?.proSubCount)} burns · ${fmtUsd(t?.proSubUsdThen)} at-time · ${usdNow(t?.proSubUsdNow)} at current price`,
          `Credits: ${fmtToken(t?.creditsVvv, "VVV")} burned in ${fmtCount(t?.creditsCount)} burns · ${fmtUsd(t?.creditsUsdThen)} at-time · ${usdNow(t?.creditsUsdNow)} at current price`,
          `Combined (the channels above): ${fmtToken(sumAll(t?.discVvv, t?.proSubVvv, t?.creditsVvv), "VVV")} · worth ${usdNow(sumAll(t?.discUsdNow, t?.proSubUsdNow, t?.creditsUsdNow))} at current price`,
          "",
        ];

        if (recent.length > 0) {
          lines.push(`### Buckets`);
          lines.push(`| Period | Disc VVV | Disc USD (then) | Pro Sub VVV | Pro Sub burns | Credits VVV | Credits burns | Combined USD (now) |`);
          lines.push(`|--------|----------|-----------------|-------------|---------------|-------------|---------------|--------------------|`);
          for (const b of recent) {
            const combined = sumAll(b.discUsdNow, b.proSubUsdNow, b.creditsUsdNow);
            lines.push(
              `| ${fmtBucketDate(b.t, granularity)} | ${fmtToken(b.discVvv)} | ${fmtUsd(b.discUsdThen)} | ${fmtToken(b.proSubVvv)} | ${fmtCount(b.proSubCount)} | ${fmtToken(b.creditsVvv)} | ${fmtCount(b.creditsCount)} | ${usdNow(combined)} |`,
            );
          }
          lines.push("");
        }

        const projected: Array<[string, (typeof d)["creditsProjection"]]> = [
          ["Discretionary", d.currentBucketProjection?.discProjected],
          ["Pro Sub", d.currentBucketProjection?.proSubProjected],
          ["Credits", d.creditsProjection],
        ];
        if (projected.some(([, p]) => p !== null && p !== undefined)) {
          lines.push(`### Still to come in the current bucket (projection, on top of the last row)`);
          for (const [label, p] of projected) {
            if (p === null || p === undefined) continue;
            lines.push(`${label}: ${fmtToken(p.vvv, "VVV")} · ${fmtUsd(p.usdcSpent)} to be spent · ${usdNow(p.usdNow)} at current price`);
          }
          lines.push("");
        }

        lines.push(deepLinkLine("/burns"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/burns",
          tip: "Use venicestats_discretionary_burn for live cycle detail or venicestats_burn_stats_by_tier for the subscription tier mix.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
