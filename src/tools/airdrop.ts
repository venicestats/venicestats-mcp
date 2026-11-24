import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtCount, fmtShare, fmtToken, firstOf, missingList, rows, text } from "../lib/format.js";

interface AirdropResponse {
  kpis: {
    totalDistributed: number;
    recipients: number;
    avgClaim: number;
    medianClaim: number;
  };
  retention: {
    activeStakers: number;
    diemOnly: number;
    inactive: number;
    retainedPct: number;
    loyalists: number;
  };
  comparison: {
    claimerAvgSvvv: number;
    claimerAvgConviction: number;
    allAvgSvvv: number;
    allAvgConviction: number;
  };
  distribution: { bucket: string; count: number; pctClaims: number; pctVvv: number }[];
  topLoyalists: { address: string; airdropAmount: number; currentSvvv: number; growth: number; ensName: string | null }[];
}

export function registerAirdropTool(server: McpServer) {
  server.tool(
    "venicestats_airdrop",
    "Returns VVV airdrop analytics from VeniceStats.com — distribution, retention rate, loyalists, breakdown by size. Use when someone asks about the airdrop or recipient behavior. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const d = await apiGet<AirdropResponse>("/api/airdrop", { mode: "overview" });
        const k = d.kpis;
        const r = d.retention;
        const cmp = d.comparison;

        const lines = [
          `## VVV Airdrop`,
          `Distributed: ${fmtToken(k?.totalDistributed, "VVV")} to ${fmtCount(k?.recipients)} recipients`,
          `Average: ${fmtToken(k?.avgClaim, "VVV")} | Median: ${fmtToken(k?.medianClaim, "VVV")}`,
          "",
          `## Retention`,
          `Active Stakers: ${fmtCount(r?.activeStakers)} (${fmtShare(r?.retainedPct)} of recipients) | DIEM Only: ${fmtCount(r?.diemOnly)} | Inactive: ${fmtCount(r?.inactive)}`,
          `Loyalists (grew beyond airdrop): ${fmtCount(r?.loyalists)}`,
          "",
          `## Distribution`,
          ...missingList(d.distribution),
          ...rows(d.distribution).map((b) => `- ${text(b.bucket)}: ${fmtCount(b.count)} recipients (${fmtShare(b.pctClaims)} of claims, ${fmtShare(b.pctVvv)} of VVV)`),
          "",
          `## Airdrop vs All Holders`,
          `Airdrop avg sVVV: ${fmtToken(cmp?.claimerAvgSvvv)} | All avg: ${fmtToken(cmp?.allAvgSvvv)}`,
          `Airdrop avg conviction: ${fmtCount(cmp?.claimerAvgConviction)} | All avg: ${fmtCount(cmp?.allAvgConviction)}`,
        ];

        const loyalists = rows(d.topLoyalists).slice(0, 5);
        if (loyalists.length > 0) {
          lines.push("", `## Top Loyalists`);
          for (const l of loyalists) {
            lines.push(`- **${firstOf([l.ensName, l.address], "unknown wallet")}**: airdrop ${fmtToken(l.airdropAmount)} → now ${fmtToken(l.currentSvvv, "sVVV")} (${fmtCount(l.growth)}% growth)`);
          }
        }

        lines.push("", deepLinkLine("/airdrop"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/airdrop",
          tip: "Use venicestats_wallet to look up any airdrop recipient's full profile.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
