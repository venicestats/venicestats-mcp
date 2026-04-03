import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
import { fmtToken, fmtUsd } from "../lib/format.js";

interface Cohort {
  name: string;
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
  badge: string;
  inferencePerDay: number;
}

interface DiemResponse {
  cohorts: Cohort[];
  topMinters: Minter[];
  totalLockedSvvv: number;
  veniceRevenue20Pct: number;
  currentMintRate: number;
}

export function registerDiemTool(server: McpServer) {
  server.tool(
    "venicestats_diem",
    "Analyze DIEM token minting: cohort breakdown (Genesis to Current), top minters with burn rates, total locked sVVV, Venice revenue, and current mint rate. DIEM is minted by locking staked VVV (sVVV). Use when someone asks about DIEM minting, cohorts, burn rate, or who the biggest DIEM minters are.",
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async () => {
      try {
        const d = await apiGet<DiemResponse>("/api/diem-analytics");

        const lines = [
          `## DIEM Minting Overview`,
          `Current Mint Rate: ${Math.round(d.currentMintRate)} sVVV per DIEM`,
          `Total Locked: ${fmtToken(d.totalLockedSvvv, "sVVV")}`,
          `Venice Revenue (20% haircut): ${fmtUsd(d.veniceRevenue20Pct)}/year`,
          "",
          `## Cohorts`,
        ];

        for (const c of d.cohorts) {
          lines.push(`- **${c.name}**: ${c.walletCount} wallets, ${fmtToken(c.totalDiemMinted, "DIEM")} minted, avg burn rate ${Math.round(c.avgBurnRate)} sVVV/DIEM, ${Math.round(c.stillLockedPct * 100)}% still locked`);
        }

        lines.push("", `## Top 10 Minters`);
        for (const m of d.topMinters.slice(0, 10)) {
          const name = m.ensName || `${m.address.slice(0, 8)}...`;
          const inference = m.inferencePerDay > 0 ? ` | $${Math.round(m.inferencePerDay)}/day inference` : "";
          lines.push(`- **${name}** (${m.badge}): ${fmtToken(m.outstandingDiem, "DIEM")} outstanding, ${fmtToken(m.svvvLocked, "sVVV")} locked, rate ${Math.round(m.burnRate)}${inference}`);
        }

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
