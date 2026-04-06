import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtToken } from "../lib/format.js";

interface WeekPoint {
  t: number; // unix ms
  v: number;
}

interface BreakdownPoint {
  t: number;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
}

interface TopAuthor {
  handle: string;
  buzzScore: number;
  mentionCount?: number;
}

interface BuzzMetricsResponse {
  totalMentions: number;
  avgEngagement: number;
  uniqueAuthors: number;
  totalViews: number;
  engagementRate: number;
  topAuthor: TopAuthor;
  topAuthors: TopAuthor[];
  mentionsByWeek: WeekPoint[];
  engagementByWeek: WeekPoint[];
  viewsByWeek: WeekPoint[];
  breakdownByWeek: BreakdownPoint[];
  granularity: string;
  period: string;
}

function fmtWeekDate(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function registerBuzzMetricsTool(server: McpServer) {
  server.tool(
    "venicestats_buzz_metrics",
    "Returns aggregated social metrics from VeniceStats.com — weekly mention volume, engagement (likes/retweets/replies/bookmarks), reach (views), unique authors, and top authors with buzz scores. Historical data spanning 12+ months. Use for social trend analysis, mention volume trends, community engagement health, or creating charts. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      weeks: z.number().int().min(4).max(52).default(12).describe("Number of recent weeks to include (4-52, default 12)"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ weeks }) => {
      try {
        const d = await apiGet<BuzzMetricsResponse>("/api/buzz/metrics");

        const lines = [
          `## Venice Buzz Metrics`,
          "",
          `### Summary (All Time)`,
          `Total Mentions: ${d.totalMentions.toLocaleString()}`,
          `Unique Authors: ${d.uniqueAuthors.toLocaleString()}`,
          `Total Views: ${fmtToken(d.totalViews)}`,
          `Avg Engagement: ${d.avgEngagement.toFixed(1)}`,
          `Engagement Rate: ${d.engagementRate.toFixed(2)}%`,
          "",
        ];

        // Top authors
        const authors = d.topAuthors?.slice(0, 5) || (d.topAuthor ? [d.topAuthor] : []);
        if (authors.length > 0) {
          lines.push(`### Top Authors`);
          for (const a of authors) {
            lines.push(`- @${a.handle}: buzz score ${a.buzzScore.toLocaleString()}`);
          }
          lines.push("");
        }

        // Weekly mention volume (last N weeks)
        const mentions = d.mentionsByWeek?.slice(-weeks) || [];
        if (mentions.length > 0) {
          lines.push(`### Weekly Mention Volume (last ${mentions.length} weeks)`);
          lines.push(`| Week | Mentions |`);
          lines.push(`|------|----------|`);
          for (const p of mentions) {
            lines.push(`| ${fmtWeekDate(p.t)} | ${p.v} |`);
          }
          lines.push("");
        }

        // Weekly engagement
        const engagement = d.engagementByWeek?.slice(-weeks) || [];
        if (engagement.length > 0) {
          lines.push(`### Weekly Engagement (last ${engagement.length} weeks)`);
          lines.push(`| Week | Engagement |`);
          lines.push(`|------|------------|`);
          for (const p of engagement) {
            lines.push(`| ${fmtWeekDate(p.t)} | ${p.v.toLocaleString()} |`);
          }
          lines.push("");
        }

        // Weekly views
        const views = d.viewsByWeek?.slice(-weeks) || [];
        if (views.length > 0) {
          lines.push(`### Weekly Reach / Views (last ${views.length} weeks)`);
          lines.push(`| Week | Views |`);
          lines.push(`|------|-------|`);
          for (const p of views) {
            lines.push(`| ${fmtWeekDate(p.t)} | ${fmtToken(p.v)} |`);
          }
          lines.push("");
        }

        // Engagement breakdown (last N weeks)
        const breakdown = d.breakdownByWeek?.slice(-weeks) || [];
        if (breakdown.length > 0) {
          lines.push(`### Engagement Breakdown (last ${breakdown.length} weeks)`);
          lines.push(`| Week | Likes | Retweets | Replies | Bookmarks |`);
          lines.push(`|------|-------|----------|---------|-----------|`);
          for (const p of breakdown) {
            lines.push(`| ${fmtWeekDate(p.t)} | ${p.likes} | ${p.retweets} | ${p.replies} | ${p.bookmarks} |`);
          }
          lines.push("");
        }

        lines.push(deepLinkLine("/buzz"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/buzz",
          tip: "Use venicestats_buzz for individual recent articles/tweets, or venicestats_social for CoinGecko/Santiment sentiment.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
