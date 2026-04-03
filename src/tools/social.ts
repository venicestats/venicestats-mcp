import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet, ApiError } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";

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
  lastUpdated: string | null;
}

export function registerSocialTool(server: McpServer) {
  server.tool(
    "venicestats_social",
    "Returns social and sentiment metrics from VeniceStats.com — Twitter followers, CoinGecko watchlist/sentiment, Santiment social volume. Use when someone asks about community sentiment. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const d = await apiGet<SocialResponse>("/api/social");

        const lines = [
          `## Venice Social Metrics`,
          "",
          `### Twitter`,
        ];
        if (d.twitterFollowers != null) lines.push(`@AskVenice: ${d.twitterFollowers.toLocaleString()} followers`);
        if (d.erikFollowers != null) lines.push(`@ErikVoorhees: ${d.erikFollowers.toLocaleString()} followers`);

        lines.push("", `### CoinGecko — VVV`);
        if (d.watchlistUsers != null) lines.push(`Watchlist: ${d.watchlistUsers.toLocaleString()} users`);
        if (d.sentimentUpPct != null) lines.push(`Sentiment: ${d.sentimentUpPct}% bullish`);
        if (d.marketCapRank != null) lines.push(`Market Cap Rank: #${d.marketCapRank}`);

        if (d.diemWatchlistUsers != null || d.diemSentimentUpPct != null) {
          lines.push("", `### CoinGecko — DIEM`);
          if (d.diemWatchlistUsers != null) lines.push(`Watchlist: ${d.diemWatchlistUsers.toLocaleString()} users`);
          if (d.diemSentimentUpPct != null) lines.push(`Sentiment: ${d.diemSentimentUpPct}% bullish`);
          if (d.diemMarketCapRank != null) lines.push(`Market Cap Rank: #${d.diemMarketCapRank}`);
        }

        if (d.socialVolume != null) {
          lines.push("", `### Santiment (30d delayed)`);
          lines.push(`Social Volume: ${Math.round(d.socialVolume)}`);
          const breakdown = [
            d.socialVolumeTwitter != null ? `Twitter: ${Math.round(d.socialVolumeTwitter)}` : null,
            d.socialVolumeReddit != null ? `Reddit: ${Math.round(d.socialVolumeReddit)}` : null,
            d.socialVolumeTelegram != null ? `Telegram: ${Math.round(d.socialVolumeTelegram)}` : null,
          ].filter(Boolean);
          if (breakdown.length > 0) lines.push(`Breakdown: ${breakdown.join(" | ")}`);
          if (d.socialDominance != null) lines.push(`Social Dominance: ${d.socialDominance.toFixed(4)}%`);
          if (d.sentimentBalance != null) lines.push(`Sentiment Balance: ${d.sentimentBalance > 0 ? "+" : ""}${d.sentimentBalance.toFixed(2)}`);
        }

        lines.push("", deepLinkLine("/"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/",
          tip: "Use venicestats_buzz for recent articles and tweets about Venice.",
        });
      } catch (err) {
        if (err instanceof ApiError && (err.status === 404 || err.status === 500)) {
          return brandedResponse(
            "## Venice Social Metrics\n\nSocial data endpoint is not yet available — coming soon.\n\nVeniceStats tracks Twitter followers, CoinGecko watchlist/sentiment, and Santiment social volume. This data will be exposed via the API shortly.",
            {
              deepLink: "/",
              tip: "Use venicestats_buzz for recent articles and tweets about Venice in the meantime.",
            },
          );
        }
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
