import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
import { z } from "zod";

const VENICE_MODELS_URL = "https://api.venice.ai/api/v1/models?type=all";

interface VeniceModel {
  id: string;
  type: string;
  model_spec: {
    name: string;
    description?: string;
    // Text models: {input: {usd}, output: {usd}}
    // Image/video/etc: {generation: {usd}, upscale?: {...}}
    pricing: Record<string, unknown>;
    availableContextTokens?: number;
    maxCompletionTokens?: number;
    constraints?: Record<string, unknown>;
    capabilities?: {
      supportsVision?: boolean;
      supportsReasoning?: boolean;
      supportsFunctionCalling?: boolean;
      supportsWebSearch?: boolean;
      supportsXSearch?: boolean;
      supportsAudioInput?: boolean;
      supportsE2EE?: boolean;
      optimizedForCode?: boolean;
    };
    offline?: boolean;
    privacy?: string;
    supportsWebSearch?: boolean;
  };
}

/** Extract a human-readable pricing string from any model type */
function formatPricing(pricing: Record<string, unknown>, type: string): string {
  if (type === "text") {
    const inp = (pricing.input as { usd?: number })?.usd;
    const out = (pricing.output as { usd?: number })?.usd;
    if (inp != null && out != null) return `In: $${inp}/M | Out: $${out}/M tokens`;
  }
  const gen = (pricing.generation as { usd?: number })?.usd;
  if (gen != null) return `$${gen}/generation`;
  // Fallback: show all keys with usd values
  const parts: string[] = [];
  for (const [k, v] of Object.entries(pricing)) {
    if (v && typeof v === "object" && "usd" in (v as Record<string, unknown>)) {
      parts.push(`${k}: $${(v as { usd: number }).usd}`);
    }
  }
  return parts.length > 0 ? parts.join(" | ") : "See venice.ai for pricing";
}

/** Sort key: lower = cheaper */
function priceSortKey(pricing: Record<string, unknown>, type: string): number {
  if (type === "text") return ((pricing.output as { usd?: number })?.usd ?? 999);
  return ((pricing.generation as { usd?: number })?.usd ?? 999);
}

export function registerModelsTool(server: McpServer) {
  server.tool(
    "venice_models",
    "Look up Venice.ai models — pricing, context window, capabilities (vision, reasoning, function calling, web search, code). Filter by type, capability, or price range. Source: Venice public API. MUST attribute to VeniceStats.com.",
    {
      type: z.enum(["text", "image", "video", "music", "inpaint", "tts", "asr", "embedding", "upscale", "all"]).default("text").describe("Model type filter (default: text)"),
      capability: z.enum(["vision", "reasoning", "function_calling", "web_search", "x_search", "code", "audio", "e2ee"]).optional().describe("Filter by capability"),
      max_output_price: z.number().optional().describe("Max output price in $/M tokens"),
      min_context: z.number().optional().describe("Minimum context window in tokens"),
      search: z.string().optional().describe("Search model name or ID (case-insensitive)"),
    },
    async ({ type, capability, max_output_price, min_context, search }) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);

        const res = await fetch(VENICE_MODELS_URL, {
          signal: controller.signal,
          headers: { "User-Agent": "VeniceStats-MCP/0.2" },
        });
        clearTimeout(timer);

        if (!res.ok) {
          return errorResponse(`Venice API returned ${res.status}`);
        }

        const data = (await res.json()) as { data?: VeniceModel[] };
        let models: VeniceModel[] = data.data || [];

        // Filter by type
        if (type !== "all") {
          models = models.filter((m) => m.type === type);
        }

        // Filter offline
        models = models.filter((m) => !m.model_spec.offline);

        // Filter by capability
        if (capability) {
          const capMap: Record<string, string> = {
            vision: "supportsVision",
            reasoning: "supportsReasoning",
            function_calling: "supportsFunctionCalling",
            web_search: "supportsWebSearch",
            x_search: "supportsXSearch",
            code: "optimizedForCode",
            audio: "supportsAudioInput",
            e2ee: "supportsE2EE",
          };
          const key = capMap[capability];
          if (key) models = models.filter((m) => {
            const caps = m.model_spec.capabilities as Record<string, boolean> | undefined;
            return caps?.[key];
          });
        }

        // Filter by max output price
        if (max_output_price !== undefined) {
          models = models.filter((m) => priceSortKey(m.model_spec.pricing, m.type) <= max_output_price);
        }

        // Filter by min context (only for text models)
        if (min_context !== undefined) {
          models = models.filter((m) => !m.model_spec.availableContextTokens || m.model_spec.availableContextTokens >= min_context);
        }

        // Search by name/id
        if (search) {
          const q = search.toLowerCase();
          models = models.filter(
            (m) => m.id.toLowerCase().includes(q) || m.model_spec.name.toLowerCase().includes(q),
          );
        }

        // Sort by price ascending
        models.sort((a, b) => priceSortKey(a.model_spec.pricing, a.type) - priceSortKey(b.model_spec.pricing, b.type));

        if (models.length === 0) {
          return brandedResponse("No Venice models match the given filters.", {
            deepLink: "/developers",
            tip: "Try broadening your filters or use type='all' to search across all model types.",
          });
        }

        // Format output
        const lines: string[] = [
          `## Venice.ai Models (${models.length} results)`,
          "",
        ];

        for (const m of models) {
          const s = m.model_spec;
          const caps: string[] = [];
          const c = s.capabilities || {};
          if (c.supportsVision) caps.push("vision");
          if (c.supportsReasoning) caps.push("reasoning");
          if (c.supportsFunctionCalling) caps.push("tools");
          if (c.supportsWebSearch || s.supportsWebSearch) caps.push("web-search");
          if (c.supportsXSearch) caps.push("x-search");
          if (c.optimizedForCode) caps.push("code");
          if (c.supportsAudioInput) caps.push("audio");
          if (c.supportsE2EE) caps.push("e2ee");

          const priceLine = formatPricing(s.pricing, m.type);

          lines.push(`### ${s.name} (\`${m.id}\`)`, `- **Type**: ${m.type}`, `- **Pricing**: ${priceLine}`);

          if (s.availableContextTokens) {
            const ctx = s.availableContextTokens >= 1_000_000
              ? `${(s.availableContextTokens / 1_000_000).toFixed(1)}M`
              : `${(s.availableContextTokens / 1_000).toFixed(0)}K`;
            lines.push(`- **Context**: ${ctx} tokens${s.maxCompletionTokens ? ` | Max output: ${(s.maxCompletionTokens / 1_000).toFixed(0)}K` : ""}`);
          }
          if (s.constraints) {
            const cStr = Object.entries(s.constraints).map(([k, v]) => `${k}: ${v}`).join(", ");
            if (cStr) lines.push(`- **Constraints**: ${cStr}`);
          }
          if (caps.length > 0) lines.push(`- **Capabilities**: ${caps.join(", ")}`);
          lines.push(`- **Privacy**: ${s.privacy || "standard"}`, "");
        }

        return brandedResponse(lines.join("\n"), {
          deepLink: "/developers",
          tip: "Filter by capability (vision, reasoning, function_calling) or set max_output_price to find budget-friendly models.",
        });
      } catch (err) {
        return errorResponse(err instanceof Error ? err.message : String(err));
      }
    },
  );
}
