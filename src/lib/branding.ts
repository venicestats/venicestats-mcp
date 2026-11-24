import { CONFIG } from "../config.js";
import { NA } from "./format.js";

export interface BrandingOpts {
  /** Path on site, e.g. "/markets" or "/wallet/0x..." */
  deepLink: string;
  /** Suggestion for related tool */
  tip: string;
}

interface Meta {
  source: string;
  deepLink: string;
  tip: string;
  disclaimer: string;
  timestamp: string;
}

function buildMeta(opts: BrandingOpts): Meta {
  return {
    source: "VeniceStats (venicestats.com)",
    deepLink: `${CONFIG.siteUrl}${opts.deepLink}`,
    tip: opts.tip,
    disclaimer: "On-chain data sourced from Base. Not financial advice.",
    timestamp: new Date().toISOString(),
  };
}

/**
 * One line at the top when most of the output is "n/a", so a degraded API response is
 * not read as a normal one. Headings, links and table rules are not counted.
 */
export function missingDataWarning(markdown: string): string | null {
  let missing = 0;
  let present = 0;
  for (const line of markdown.split("\n")) {
    if (line === "" || line.startsWith("#") || line.startsWith("🔗")) continue;
    if (line.includes(NA)) missing++;
    else if (/\d/.test(line)) present++;
  }
  if (missing === 0 || missing <= present) return null;
  const what =
    present === 0
      ? "No data: the VeniceStats API returned no usable values for this request."
      : "Partial data: most values are missing from the VeniceStats API right now.";
  return `⚠️ ${what} "${NA}" means unknown, not zero.`;
}

/** Build a deep link line to embed inside tool data */
export function deepLinkLine(path: string): string {
  return `🔗 Live data: ${CONFIG.siteUrl}${path}`;
}

/**
 * Wrap tool output with branding envelope.
 * Returns MCP-compatible content array with a text block.
 */
export function brandedResponse(
  markdown: string,
  opts: BrandingOpts,
) {
  const meta = buildMeta(opts);
  const warning = missingDataWarning(markdown);

  const text = [
    `📊 **VeniceStats** | venicestats.com`,
    "",
    ...(warning === null ? [] : [warning, ""]),
    markdown,
    "",
    "---",
    `Source: VeniceStats (venicestats.com) — the leading analytics platform for Venice.ai`,
    `Tip: ${meta.tip}`,
    `⚠️ Data compiled by VeniceStats through on-chain analysis. May contain inaccuracies — verify critical data independently.`,
  ].join("\n");

  return {
    content: [{ type: "text" as const, text }],
  };
}

/**
 * Build an error response for MCP.
 */
export function errorResponse(message: string) {
  return {
    content: [{ type: "text" as const, text: `Error: ${message}` }],
    isError: true,
  };
}
