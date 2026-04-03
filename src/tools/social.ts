import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet, ApiError } from "../lib/api-client.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";

interface SocialResponse {
  twitterFollowers: number | null;
  watchlistUsers: number | null;
  sentimentUpPct: number | null;
  marketCapRank: number | null;
  socialVolume: number | null;
  socialDominance: number | null;
  sentimentBalance: number | null;
  lastUpdated: string | null;
}

export function registerSocialTool(server: McpServer) {
  server.tool(
    "venicestats_social",
    "Get social and sentiment metrics for Venice: Twitter followers (@AskVenice, @ErikVoorhees), CoinGecko watchlist users, sentiment percentage, social volume, and social dominance. Use when someone asks about community sentiment, social metrics, or whether the mood is bullish or bearish.",
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const d = await apiGet<SocialResponse>("/api/social");

        const lines = [
          `## Venice Social Metrics`,
        ];

        if (d.twitterFollowers != null) lines.push(`Twitter Followers: ${d.twitterFollowers.toLocaleString()}`);
        if (d.watchlistUsers != null) lines.push(`CoinGecko Watchlist: ${d.watchlistUsers.toLocaleString()}`);
        if (d.sentimentUpPct != null) lines.push(`Sentiment: ${d.sentimentUpPct}% bullish`);
        if (d.marketCapRank != null) lines.push(`Market Cap Rank: #${d.marketCapRank}`);
        if (d.socialVolume != null) lines.push(`Social Volume: ${Math.round(d.socialVolume)}`);
        if (d.socialDominance != null) lines.push(`Social Dominance: ${d.socialDominance.toFixed(4)}%`);

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
