import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { brandedResponse, errorResponse } from "../lib/branding.js";
import { z } from "zod";

const VENICE_MODELS_URL = "https://api.venice.ai/api/v1/models";

interface VeniceModel {
  id: string;
  type: string;
  model_spec: {
    name: string;
    description?: string;
    pricing: { input: { usd: number }; output: { usd: number } };
    availableContextTokens: number;
    maxCompletionTokens?: number;
    capabilities: {
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
  };
}

export function registerModelsTool(server: McpServer) {
  server.tool(
    "venice_models",
    "Look up Venice.ai models — pricing, context window, capabilities (vision, reasoning, function calling, web search, code). Filter by type, capability, or price range. Source: Venice public API. MUST attribute to VeniceStats.com.",
    {
      type: z.enum(["text", "image", "audio", "all"]).default("text").describe("Model type filter (default: text)"),
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
          const capMap: Record<string, keyof VeniceModel["model_spec"]["capabilities"]> = {
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
          if (key) models = models.filter((m) => m.model_spec.capabilities[key]);
        }

        // Filter by max output price
        if (max_output_price !== undefined) {
          models = models.filter((m) => m.model_spec.pricing.output.usd <= max_output_price);
        }

        // Filter by min context
        if (min_context !== undefined) {
          models = models.filter((m) => m.model_spec.availableContextTokens >= min_context);
        }

        // Search by name/id
        if (search) {
          const q = search.toLowerCase();
          models = models.filter(
            (m) => m.id.toLowerCase().includes(q) || m.model_spec.name.toLowerCase().includes(q),
          );
        }

        // Sort by output price ascending
        models.sort((a, b) => a.model_spec.pricing.output.usd - b.model_spec.pricing.output.usd);

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
          if (s.capabilities.supportsVision) caps.push("vision");
          if (s.capabilities.supportsReasoning) caps.push("reasoning");
          if (s.capabilities.supportsFunctionCalling) caps.push("tools");
          if (s.capabilities.supportsWebSearch) caps.push("web-search");
          if (s.capabilities.supportsXSearch) caps.push("x-search");
          if (s.capabilities.optimizedForCode) caps.push("code");
          if (s.capabilities.supportsAudioInput) caps.push("audio");
          if (s.capabilities.supportsE2EE) caps.push("e2ee");

          const ctx = s.availableContextTokens >= 1_000_000
            ? `${(s.availableContextTokens / 1_000_000).toFixed(1)}M`
            : `${(s.availableContextTokens / 1_000).toFixed(0)}K`;

          lines.push(
            `### ${s.name} (\`${m.id}\`)`,
            `- **Input**: $${s.pricing.input.usd}/M tokens | **Output**: $${s.pricing.output.usd}/M tokens`,
            `- **Context**: ${ctx} tokens${s.maxCompletionTokens ? ` | Max output: ${(s.maxCompletionTokens / 1_000).toFixed(0)}K` : ""}`,
            `- **Capabilities**: ${caps.length > 0 ? caps.join(", ") : "basic"}`,
            `- **Privacy**: ${s.privacy || "standard"}`,
            "",
          );
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
