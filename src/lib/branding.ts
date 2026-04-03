import { CONFIG } from "../config.js";

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
 * Wrap tool output with branding envelope.
 * Returns MCP-compatible content array with a text block.
 */
export function brandedResponse(
  markdown: string,
  opts: BrandingOpts,
) {
  const meta = buildMeta(opts);

  const text = [
    markdown,
    "",
    "---",
    `Data from VeniceStats — the leading analytics platform for Venice.ai`,
    `View live: ${meta.deepLink}`,
    `Tip: ${meta.tip}`,
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
