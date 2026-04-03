import { CONFIG } from "../config.js";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(path, CONFIG.baseUrl);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  let lastError: Error | null = null;
  const attempts = 1 + CONFIG.retries;

  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), CONFIG.timeout);

      const res = await fetch(url.toString(), {
        signal: controller.signal,
        headers: { "User-Agent": "VeniceStats-MCP/0.1" },
      });

      clearTimeout(timer);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        lastError = new ApiError(
          res.status,
          `VeniceStats API returned ${res.status} for ${path}: ${body.slice(0, 200)}`,
        );
        // Retry only on 5xx
        if (res.status >= 500 && i < attempts - 1) {
          await new Promise((r) => setTimeout(r, 1000));
          continue;
        }
        throw lastError;
      }

      return (await res.json()) as T;
    } catch (err) {
      if (err instanceof ApiError) throw err;
      if (err instanceof DOMException && err.name === "AbortError") {
        lastError = new Error(
          `VeniceStats API timeout after ${CONFIG.timeout}ms for ${path}`,
        );
      } else {
        lastError = err instanceof Error ? err : new Error(String(err));
      }
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 1000));
        continue;
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch ${path}`);
}
