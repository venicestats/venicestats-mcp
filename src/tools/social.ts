import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtCount, fmtFixed, fmtShare, num } from "../lib/format.js";

interface SocialResponse {
  twitterFollowers: number | null;
  erikFollowers: number | null;
  watchlistUsers: number | null;
  sentimentUpPct: number | null;
  marketCapRank: number | null;
  diemWatchlistUsers: number | null;
  diemSentimentUpPct: number | null;
  diemMarketCapRank: number | null;
  socialVolume: number | null;
  socialVolumeTwitter: number | null;
  socialVolumeReddit: number | null;
  socialVolumeTelegram: number | null;
  socialDominance: number | null;
  sentimentBalance: number | null;
}

export function registerSocialTool(server: McpServer) {
  server.tool(
    "venicestats_social",
    "Returns social and sentiment metrics from VeniceStats.com — Twitter followers, CoinGecko watchlist/sentiment, Santiment social volume. Use when someone asks about community sentiment. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const d = await apiGet<SocialResponse>("/api/social");

        const lines = [`## Venice Social Metrics`];
        let sections = 0;
        /** A section with the lines that have a value; nothing at all when none has. */
        const section = (title: string, entries: Array<[unknown, string]>) => {
          const known = entries.filter(([v]) => num(v) !== null).map(([, line]) => line);
          if (known.length === 0) return;
          sections++;
          lines.push("", `### ${title}`, ...known);
        };

        section("Twitter", [
          [d.twitterFollowers, `@AskVenice: ${fmtCount(d.twitterFollowers)} followers`],
          [d.erikFollowers, `@ErikVoorhees: ${fmtCount(d.erikFollowers)} followers`],
        ]);
        section("CoinGecko — VVV", [
          [d.watchlistUsers, `Watchlist: ${fmtCount(d.watchlistUsers)} users`],
          [d.sentimentUpPct, `Sentiment: ${fmtShare(d.sentimentUpPct, 2)} bullish`],
          [d.marketCapRank, `Market Cap Rank: #${fmtCount(d.marketCapRank)}`],
        ]);
        section("CoinGecko — DIEM", [
          [d.diemWatchlistUsers, `Watchlist: ${fmtCount(d.diemWatchlistUsers)} users`],
          [d.diemSentimentUpPct, `Sentiment: ${fmtShare(d.diemSentimentUpPct, 2)} bullish`],
          [d.diemMarketCapRank, `Market Cap Rank: #${fmtCount(d.diemMarketCapRank)}`],
        ]);

        const balance = num(d.sentimentBalance);
        const bySource = ([["Twitter", d.socialVolumeTwitter], ["Reddit", d.socialVolumeReddit], ["Telegram", d.socialVolumeTelegram]] as const)
          .filter(([, v]) => num(v) !== null)
          .map(([label, v]) => `${label}: ${fmtFixed(v, 0)}`);
        section("Santiment (30d delayed)", [
          [d.socialVolume, `Social Volume: ${fmtFixed(d.socialVolume, 0)}`],
          [bySource.length > 0 ? bySource.length : null, `Breakdown: ${bySource.join(" | ")}`],
          [d.socialDominance, `Social Dominance: ${fmtFixed(d.socialDominance, 4, "%")}`],
          [balance, `Sentiment Balance: ${balance !== null && balance > 0 ? "+" : ""}${fmtFixed(balance, 2)}`],
        ]);

        if (sections === 0) lines.push("", "n/a — no social data from the API right now.");
        lines.push("", deepLinkLine("/"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/",
          tip: "Use venicestats_buzz for recent articles and tweets about Venice.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
