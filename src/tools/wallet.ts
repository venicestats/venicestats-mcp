import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
import { fmtToken, fmtUsd, fmtRatio } from "../lib/format.js";

interface Badge {
  label: string;
  value: number;
}

interface Goal {
  icon: string;
  text: string;
  category: string;
}

interface WalletResponse {
  address: string;
  username: string | null;
  ensName: string | null;
  role: string;
  roleLabel: string;
  roleEmoji: string;
  era: string;
  eraLabel: string;
  sizeTier: string;
  sizeLabel: string;
  sizeEmoji: string;
  badges: string[];
  score: number;
  rank: number;
  totalVenetians: number;
  svvvBalance: number;
  svvvLocked: number;
  svvvUnlocked: number;
  pendingRewards: number;
  diemBalance: number;
  diemStaked: number;
  vvvBalance: number;
  exposureUsd: number;
  personalBurnRate: number;
  firstSeenAt: string;
  chronicle: string;
  nextGoals: Goal[];
  radar: Badge[];
}

export function registerWalletTool(server: McpServer) {
  server.tool(
    "venicestats_wallet",
    "Look up a wallet's full Venetian identity: role, era, size tier, badges, staking position, DIEM balance, conviction score, radar chart, chronicle, and next goals. Use when someone asks about a specific wallet or address.",
    {
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address").describe("Ethereum wallet address to look up"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ address }) => {
      try {
        const d = await apiGet<WalletResponse>("/api/venetians", { address });

        const name = d.ensName || d.username || `${address.slice(0, 6)}...${address.slice(-4)}`;
        const badgeList = d.badges.length > 0 ? d.badges.join(", ") : "None yet";

        const lines = [
          `## ${name}`,
          `${d.roleEmoji} **${d.roleLabel}** | ${d.eraLabel} | ${d.sizeEmoji} ${d.sizeLabel}`,
          `Rank: #${d.rank} of ${d.totalVenetians.toLocaleString()} Venetians (Score: ${d.score.toLocaleString()})`,
          "",
          `## Position`,
          `sVVV: ${fmtToken(d.svvvBalance)} (${fmtToken(d.svvvLocked)} locked, ${fmtToken(d.svvvUnlocked)} unlocked)`,
          `DIEM: ${fmtToken(d.diemBalance)} wallet + ${fmtToken(d.diemStaked)} staked`,
          `VVV (liquid): ${fmtToken(d.vvvBalance)} | Rewards pending: ${fmtToken(d.pendingRewards)}`,
          `Total Exposure: ${fmtUsd(d.exposureUsd)}`,
          d.personalBurnRate > 0 ? `Personal Burn Rate: ${Math.round(d.personalBurnRate)} sVVV/DIEM` : "",
          "",
          `## Badges (${d.badges.length})`,
          badgeList,
          "",
          `## Radar`,
          ...d.radar.map((r) => `- ${r.label}: ${r.value}/100`),
          "",
          `## Chronicle`,
          d.chronicle,
        ];

        if (d.nextGoals.length > 0) {
          lines.push("", `## Next Goals`);
          for (const g of d.nextGoals) {
            lines.push(`${g.icon} ${g.text}`);
          }
        }

        return brandedResponse(lines.filter(Boolean).join("\n"), {
          deepLink: `/wallet/${address}`,
          tip: "Use venicestats_wallet_trades for this wallet's trading history and cost basis.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
