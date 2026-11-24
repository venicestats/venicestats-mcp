import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { firstOf, fmtCount, fmtFixed, fmtToken, fmtUsd, missingList, num, positive, rows } from "../lib/format.js";

interface Cohort {
  /** Stable id; show `label`. */
  name: string;
  label?: string;
  /** Today's mint rate is in this band. */
  mintingNow?: boolean;
  walletCount: number;
  totalDiemMinted: number;
  avgBurnRate: number;
  stillLockedPct: number;
}

interface Minter {
  address: string;
  ensName: string | null;
  svvvLocked: number;
  outstandingDiem: number;
  burnRate: number;
  /** Stable id; show `badgeLabel`. */
  badge: string;
  badgeLabel?: string;
  inferencePerDay: number;
}

interface DiemResponse {
  cohorts: Cohort[];
  topMinters: Minter[];
  totalLockedSvvv: number;
  /** Haircut on the emissions of locked sVVV, USD per year. */
  veniceRevenue20Pct: number | null;
  currentMintRate: number;
}

export function registerDiemTool(server: McpServer) {
  server.tool(
    "venicestats_diem",
    "Returns DIEM minting analytics from VeniceStats.com — cohort breakdown (bands of the rate each wallet minted at), top minters, burn rates, and the emission haircut on locked sVVV. Use when someone asks about DIEM minting or cohorts. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const d = await apiGet<DiemResponse>("/api/diem-analytics");
        const mintRate = positive(d.currentMintRate);

        const lines = [
          `## DIEM Minting Overview`,
          `Current Mint Rate: ${fmtFixed(mintRate, 0, " sVVV per DIEM")}`,
          `Total Locked: ${fmtToken(d.totalLockedSvvv, "sVVV")}`,
          `Emission haircut on locked sVVV (kept by Venice, not total revenue): ${fmtUsd(d.veniceRevenue20Pct)}/year`,
          "",
          `## Cohorts (by the rate each wallet minted at)`,
          ...missingList(d.cohorts),
        ];

        for (const c of rows(d.cohorts)) {
          const now = c.mintingNow === true ? (mintRate === null ? " (minting now)" : ` (minting now at ${Math.round(mintRate)})`) : "";
          const locked = num(c.stillLockedPct);
          lines.push(`- **${firstOf([c.label, c.name], "unnamed cohort")}**${now}: ${fmtCount(c.walletCount)} wallets, ${fmtToken(c.totalDiemMinted, "DIEM")} minted, avg burn rate ${fmtFixed(c.avgBurnRate, 0)} sVVV/DIEM, ${fmtFixed(locked === null ? null : locked * 100, 0, "%")} still locked`);
        }

        lines.push("", `## Top Minters`, ...missingList(d.topMinters));
        for (const m of rows(d.topMinters).slice(0, 10)) {
          const name = firstOf([m.ensName, m.address], "unknown wallet");
          const badge = firstOf([m.badgeLabel, m.badge], "no cohort");
          const inference = positive(m.inferencePerDay);
          lines.push(`- **${name}** (${badge}): ${fmtToken(m.outstandingDiem, "DIEM")} outstanding, ${fmtToken(m.svvvLocked, "sVVV")} locked, rate ${fmtFixed(m.burnRate, 0)}${inference === null ? "" : ` | $${Math.round(inference)}/day inference`}`);
        }

        lines.push("", deepLinkLine("/diem"));

        return brandedResponse(lines.join("\n"), {
          deepLink: "/diem",
          tip: "Use venicestats_protocol_overview with category='diem' for DIEM price and supply metrics.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
