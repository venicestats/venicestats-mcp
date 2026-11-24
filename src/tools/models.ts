import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
import { NA, firstOf, fmtDate, num, positive, rows, str, text, type Maybe } from "../lib/format.js";
import { z } from "zod";

const VENICE_MODELS_URL = "https://api.venice.ai/api/v1/models?type=all";

const NO_PRICE = "See venice.ai for pricing";

interface VeniceModelShape {
  id: string;
  type: string;
  /** Unix seconds — when Venice added the model. */
  created?: number;
  model_spec: {
    name: string;
    // Text models: {input: {usd}, output: {usd}}
    // Image/etc: {generation: {usd}, upscale?: {...}}
    // Video models in current API have NO pricing field — handle as undefined.
    pricing?: Record<string, unknown>;
    availableContextTokens?: number;
    maxCompletionTokens?: number;
    constraints?: Record<string, unknown>;
    capabilities?: Record<string, unknown>;
    offline?: boolean;
    privacy?: string;
    supportsWebSearch?: boolean;
  };
}

type VeniceModel = NonNullable<Maybe<VeniceModelShape>>;

/** The `usd` of one entry of a pricing object, or null. */
function usdOf(pricing: unknown, key: string): number | null {
  if (pricing === null || typeof pricing !== "object") return null;
  const entry = (pricing as Record<string, unknown>)[key];
  if (entry === null || typeof entry !== "object") return null;
  return num((entry as { usd?: unknown }).usd);
}

/** Extract a human-readable pricing string from any model type */
function formatPricing(pricing: unknown, type: unknown): string {
  if (pricing === null || typeof pricing !== "object") return NO_PRICE;
  if (type === "text") {
    const inp = usdOf(pricing, "input");
    const out = usdOf(pricing, "output");
    if (inp !== null && out !== null) return `In: $${inp}/M | Out: $${out}/M tokens`;
  }
  const gen = usdOf(pricing, "generation");
  if (gen !== null) return `$${gen}/generation`;
  // Fallback: show all keys with usd values
  const parts = Object.keys(pricing)
    .map((k) => [k, usdOf(pricing, k)] as const)
    .filter(([, usd]) => usd !== null)
    .map(([k, usd]) => `${k}: $${usd}`);
  return parts.length > 0 ? parts.join(" | ") : NO_PRICE;
}

/** Sort key: lower = cheaper. Null (no price, e.g. all video models in current API) sorts last. */
function priceKey(m: VeniceModel): number | null {
  return usdOf(m.model_spec?.pricing, m.type === "text" ? "output" : "generation");
}

/** Compare two numbers in the given order, with the missing ones always last. */
function nullsLast(a: number | null, b: number | null, order: "asc" | "desc"): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return order === "asc" ? a - b : b - a;
}

/** A value inside a constraint as text. */
function scalar(v: unknown): string {
  if (typeof v === "number") return num(v) === null ? NA : String(v);
  if (typeof v === "string") return text(v);
  if (typeof v === "boolean") return String(v);
  if (v === null || v === undefined) return NA;
  return JSON.stringify(v, (_k, x: unknown) => (x === null || (typeof x === "number" && num(x) === null) ? NA : x));
}

/** Format a single constraint value into a human-readable string.
 * Venice constraints come in 4 shapes: dict ({min/max/default}), array (resolutions/aspectRatios), primitives, unknown. */
function formatConstraintValue(v: unknown): string {
  if (Array.isArray(v)) return v.length === 0 ? NA : v.map(scalar).join("/");
  if (v !== null && typeof v === "object") {
    const { min, max, default: def } = v as { min?: unknown; max?: unknown; default?: unknown };
    if (min != null && max != null) {
      return def != null ? `${scalar(min)}–${scalar(max)} (default ${scalar(def)})` : `${scalar(min)}–${scalar(max)}`;
    }
    if (max != null) return def != null ? `default ${scalar(def)}, max ${scalar(max)}` : `max ${scalar(max)}`;
    if (def != null) return `default ${scalar(def)}`;
  }
  return scalar(v);
}

export function registerModelsTool(server: McpServer) {
  server.tool(
    "venice_models",
    "Look up Venice.ai models — pricing, context window, capabilities (vision, reasoning, function calling, web search, code), and date added to Venice. Filter by type, capability, or price range. Sort by price (default, ascending), recent (newest additions first — use for 'newest'/'latest' questions), or context (largest window first). Use `limit` to cap results. Source: Venice public API. MUST attribute to VeniceStats.com.",
    {
      type: z.enum(["text", "image", "video", "music", "inpaint", "tts", "asr", "embedding", "upscale", "all"]).default("text").describe("Model type filter (default: text)"),
      capability: z.enum(["vision", "reasoning", "function_calling", "web_search", "x_search", "code", "audio", "e2ee"]).optional().describe("Filter by capability"),
      max_output_price: z.number().optional().describe("Max output price in $/M tokens"),
      min_context: z.number().optional().describe("Minimum context window in tokens"),
      search: z.string().optional().describe("Search model name or ID (case-insensitive)"),
      sort: z.enum(["price", "recent", "context"]).default("price").describe("Sort order. 'price' (default) = cheapest first. 'recent' = newest additions to Venice first (use for 'newest'/'latest'/'recent' questions). 'context' = largest context window first."),
      limit: z.number().int().min(1).max(100).optional().describe("Cap results to this many models after sorting (max 100). Use small values like 5-10 when the user asks for 'top N'."),
    },
    async ({ type, capability, max_output_price, min_context, search, sort, limit }) => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);

        const res = await fetch(VENICE_MODELS_URL, {
          signal: controller.signal,
          headers: { "User-Agent": "VeniceStats-MCP/0.6" },
        });
        clearTimeout(timer);

        if (!res.ok) {
          return errorResponse(`Venice API returned ${res.status}`);
        }

        const data = (await res.json()) as Maybe<{ data: VeniceModelShape[] }>;
        if (!Array.isArray(data?.data)) return errorResponse("Venice API returned no model list");
        let models: VeniceModel[] = rows(data.data);

        // Filter by type
        if (type !== "all") {
          models = models.filter((m) => m.type === type);
        }

        // Filter offline
        models = models.filter((m) => m.model_spec?.offline !== true);

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
          if (key) models = models.filter((m) => (m.model_spec?.capabilities as Record<string, unknown> | null | undefined)?.[key] === true);
        }

        // Filter by max output price (a model without a price cannot be within it)
        if (max_output_price !== undefined) {
          models = models.filter((m) => {
            const price = priceKey(m);
            return price !== null && price <= max_output_price;
          });
        }

        // Filter by min context (only for text models)
        if (min_context !== undefined) {
          models = models.filter((m) => {
            const ctx = positive(m.model_spec?.availableContextTokens);
            return ctx === null || ctx >= min_context;
          });
        }

        // Search by name/id
        if (search) {
          const q = search.toLowerCase();
          models = models.filter((m) =>
            [m.id, m.model_spec?.name].some((v) => str(v)?.toLowerCase().includes(q)),
          );
        }

        // Sort
        if (sort === "recent") {
          models.sort((a, b) => nullsLast(num(a.created), num(b.created), "desc"));
        } else if (sort === "context") {
          models.sort((a, b) => nullsLast(num(a.model_spec?.availableContextTokens), num(b.model_spec?.availableContextTokens), "desc"));
        } else {
          models.sort((a, b) => nullsLast(priceKey(a), priceKey(b), "asc"));
        }

        // Cap results
        if (typeof limit === "number" && limit > 0) {
          models = models.slice(0, limit);
        }

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
          const s: NonNullable<VeniceModel["model_spec"]> = m.model_spec ?? {};
          const caps: string[] = [];
          const c = (s.capabilities ?? {}) as Record<string, unknown>;
          if (c.supportsVision) caps.push("vision");
          if (c.supportsReasoning) caps.push("reasoning");
          if (c.supportsFunctionCalling) caps.push("tools");
          if (c.supportsWebSearch || s.supportsWebSearch) caps.push("web-search");
          if (c.supportsXSearch) caps.push("x-search");
          if (c.optimizedForCode) caps.push("code");
          if (c.supportsAudioInput) caps.push("audio");
          if (c.supportsE2EE) caps.push("e2ee");

          lines.push(
            `### ${firstOf([s.name, m.id], "Unnamed model")} (\`${firstOf([m.id], "no id")}\`)`,
            `- **Type**: ${text(m.type)}`,
            `- **Pricing**: ${formatPricing(s.pricing, m.type)}`,
          );

          const ctxTokens = positive(s.availableContextTokens);
          if (ctxTokens !== null) {
            const ctx = ctxTokens >= 1_000_000
              ? `${(ctxTokens / 1_000_000).toFixed(1)}M`
              : `${(ctxTokens / 1_000).toFixed(0)}K`;
            const maxOut = positive(s.maxCompletionTokens);
            lines.push(`- **Context**: ${ctx} tokens${maxOut !== null ? ` | Max output: ${(maxOut / 1_000).toFixed(0)}K` : ""}`);
          }
          if (s.constraints) {
            const cStr = Object.entries(s.constraints)
              .map(([k, v]) => `${k}: ${formatConstraintValue(v)}`)
              .join(", ");
            if (cStr) lines.push(`- **Constraints**: ${cStr}`);
          }
          if (caps.length > 0) lines.push(`- **Capabilities**: ${caps.join(", ")}`);
          const privacy = str(s.privacy);
          if (privacy !== null) lines.push(`- **Privacy**: ${privacy}`);
          const created = positive(m.created);
          if (created !== null) lines.push(`- **Added to Venice**: ${fmtDate(created * 1000)}`);
          lines.push("");
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
