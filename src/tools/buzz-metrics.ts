import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtCount, fmtDate, fmtFixed, fmtToken, rows, text } from "../lib/format.js";

interface WeekPoint {
  t: number; // unix ms
  v: number;
}

interface BreakdownPoint {
  t: number;
  likes: number;
  rts: number;
  replies: number;
  bookmarks: number;
}

interface TopAuthor {
  handle: string;
  buzzScore: number;
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
          `Total Mentions: ${fmtCount(d.totalMentions)}`,
          `Unique Authors: ${fmtCount(d.uniqueAuthors)}`,
          `Total Views: ${fmtToken(d.totalViews)}`,
          `Avg Engagement: ${fmtFixed(d.avgEngagement, 1)}`,
          `Engagement Rate: ${fmtFixed(d.engagementRate, 2, "%")}`,
          "",
        ];

        // Top authors
        const ranked = rows(d.topAuthors).slice(0, 5);
        const authors = ranked.length > 0 ? ranked : rows([d.topAuthor]);
        if (authors.length > 0) {
          lines.push(`### Top Authors`);
          for (const a of authors) {
            lines.push(`- @${text(a.handle)}: buzz score ${fmtCount(a.buzzScore)}`);
          }
          lines.push("");
        }

        const weekTable = (title: string, column: string, points: typeof d.mentionsByWeek, fmt: (v: unknown) => string) => {
          const last = rows(points).slice(-weeks);
          if (last.length === 0) return;
          lines.push(`### ${title} (last ${last.length} weeks)`, `| Week | ${column} |`, `|------|------|`);
          for (const p of last) lines.push(`| ${fmtDate(p.t)} | ${fmt(p.v)} |`);
          lines.push("");
        };
        weekTable("Weekly Mention Volume", "Mentions", d.mentionsByWeek, fmtCount);
        weekTable("Weekly Engagement", "Engagement", d.engagementByWeek, fmtCount);
        weekTable("Weekly Reach / Views", "Views", d.viewsByWeek, (v) => fmtToken(v));

        // Engagement breakdown (last N weeks)
        const breakdown = rows(d.breakdownByWeek).slice(-weeks);
        if (breakdown.length > 0) {
          lines.push(`### Engagement Breakdown (last ${breakdown.length} weeks)`);
          lines.push(`| Week | Likes | Retweets | Replies | Bookmarks |`);
          lines.push(`|------|-------|----------|---------|-----------|`);
          for (const p of breakdown) {
            lines.push(`| ${fmtDate(p.t)} | ${fmtCount(p.likes)} | ${fmtCount(p.rts)} | ${fmtCount(p.replies)} | ${fmtCount(p.bookmarks)} |`);
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
