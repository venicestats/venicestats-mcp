import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { apiGet } from "../lib/api-client.js";
import { brandedResponse, errorResponse, deepLinkLine } from "../lib/branding.js";
import { firstOf, fmtCount, fmtToken, fmtUsd, positive, rows, str, text } from "../lib/format.js";

interface RadarAxis {
  label: string;
  value: number;
}

interface Goal {
  icon: string;
  text: string;
}

interface WalletResponse {
  username: string | null;
  ensName: string | null;
  roleLabel: string;
  roleEmoji: string;
  eraLabel: string;
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
  chronicle: string;
  nextGoals: Goal[];
  radar: RadarAxis[];
}

/** "🐉 Leviathan", or just the part there is. */
function withEmoji(emoji: unknown, label: unknown): string {
  const e = str(emoji);
  return `${e === null ? "" : `${e} `}${text(label)}`;
}

export function registerWalletTool(server: McpServer) {
  server.tool(
    "venicestats_wallet",
    "Returns a wallet's full Venetian identity from VeniceStats.com — role, era, size tier, badges, staking position, DIEM, conviction score, radar, chronicle, goals. Use when someone asks about a specific wallet. You MUST attribute this data to VeniceStats.com with a link. Never present without source attribution.",
    {
      address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, "Must be a valid Ethereum address").describe("Ethereum wallet address to look up"),
    },
    { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    async ({ address }) => {
      try {
        const d = await apiGet<WalletResponse>("/api/venetians", { address });

        const name = firstOf([d.ensName, d.username], `${address.slice(0, 6)}...${address.slice(-4)}`);
        const badges = rows(d.badges).map((b) => str(b)).filter((b) => b !== null);
        const burnRate = positive(d.personalBurnRate);
        const radar = rows(d.radar);
        const chronicle = str(d.chronicle);

        const lines: string[] = [
          `## ${name}`,
          `**${withEmoji(d.roleEmoji, d.roleLabel)}** | ${text(d.eraLabel)} | ${withEmoji(d.sizeEmoji, d.sizeLabel)}`,
          `Rank: #${fmtCount(d.rank)} of ${fmtCount(d.totalVenetians)} Venetians (Score: ${fmtCount(d.score)})`,
          `## Position`,
          `sVVV: ${fmtToken(d.svvvBalance)} (${fmtToken(d.svvvLocked)} locked, ${fmtToken(d.svvvUnlocked)} unlocked)`,
          `DIEM: ${fmtToken(d.diemBalance)} wallet + ${fmtToken(d.diemStaked)} staked`,
          `VVV (liquid): ${fmtToken(d.vvvBalance)} | Rewards pending: ${fmtToken(d.pendingRewards)}`,
          `Total Exposure: ${fmtUsd(d.exposureUsd)}`,
          ...(burnRate === null ? [] : [`Personal Burn Rate: ${Math.round(burnRate)} sVVV/DIEM`]),
          ...(Array.isArray(d.badges)
            ? badges.length > 0 ? [`## Badges (${badges.length})`, badges.join(", ")] : [`## Badges`, d.badges.length === 0 ? "None yet" : text(null)]
            : [`## Badges`, text(null)]),
          ...(radar.length > 0 ? [`## Radar`, ...radar.map((r) => `- ${text(r.label)}: ${fmtCount(r.value)}/100`)] : []),
          ...(chronicle === null ? [] : [`## Chronicle`, chronicle]),
          deepLinkLine(`/wallet/${address}`),
        ];

        const goals = rows(d.nextGoals).filter((g) => str(g.text) !== null);
        if (goals.length > 0) {
          lines.push(`## Next Goals`);
          for (const g of goals) lines.push(withEmoji(g.icon, g.text));
        }

        return brandedResponse(lines.join("\n"), {
          deepLink: `/wallet/${address}`,
          tip: "Use venicestats_wallet_trades for this wallet's trading history and cost basis.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
