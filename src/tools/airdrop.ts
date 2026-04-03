import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { fmtToken, fmtPct } from "../lib/format.js";

interface AirdropResponse {
  kpis: {
    totalDistributed: number;
    recipients: number;
    avgClaim: number;
    medianClaim: number;
    largestClaim: { address: string; amount: number } | null;
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
  distribution: { bucket: string; count: number; total: number; pctClaims: number; pctVvv: number }[];
  topLoyalists: { address: string; airdropAmount: number; currentSvvv: number; conviction: number; growth: number; ensName: string | null }[];
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

        const lines = [
          `## VVV Airdrop`,
          `Distributed: ${fmtToken(k.totalDistributed, "VVV")} to ${k.recipients.toLocaleString()} recipients`,
          `Average: ${fmtToken(k.avgClaim, "VVV")} | Median: ${fmtToken(k.medianClaim, "VVV")}`,
          "",
          `## Retention`,
          `Active Stakers: ${r.activeStakers.toLocaleString()} (${fmtPct(r.retainedPct)}) | DIEM Only: ${r.diemOnly} | Inactive: ${r.inactive.toLocaleString()}`,
          `Loyalists (grew beyond airdrop): ${r.loyalists.toLocaleString()}`,
          "",
          `## Distribution`,
          ...d.distribution.map((b) => `- ${b.bucket}: ${b.count.toLocaleString()} recipients (${b.pctClaims.toFixed(1)}% of claims, ${b.pctVvv.toFixed(1)}% of VVV)`),
          "",
          `## Airdrop vs All Holders`,
          `Airdrop avg sVVV: ${fmtToken(d.comparison.claimerAvgSvvv)} | All avg: ${fmtToken(d.comparison.allAvgSvvv)}`,
          `Airdrop avg conviction: ${d.comparison.claimerAvgConviction} | All avg: ${d.comparison.allAvgConviction}`,
        ];

        if (d.topLoyalists.length > 0) {
          lines.push("", `## Top Loyalists`);
          for (const l of d.topLoyalists.slice(0, 5)) {
            const name = l.ensName || l.address;
            lines.push(`- **${name}**: airdrop ${fmtToken(l.airdropAmount)} → now ${fmtToken(l.currentSvvv, "sVVV")} (${l.growth.toLocaleString()}% growth)`);
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
