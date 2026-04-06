import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";
import rateLimit from "express-rate-limit";
import { createServer } from "./server.js";

async function main() {
  const transport = process.argv.includes("--http")
    ? await startHttp()
    : await startStdio();

  if (!transport) process.exit(1);
}

async function startStdio() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[venicestats-mcp] Running on stdio");
  return transport;
}

async function startHttp() {
  const port = parseInt(process.env.PORT || "3333", 10);
  const app = express();
  app.use(express.json());
  app.use(rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false }));

  // Stateless: new transport + server per request
  app.post("/mcp", async (req, res) => {
    try {
      const server = createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
        enableJsonResponse: true,
      });

      res.on("close", () => {
        transport.close();
        server.close();
      });

      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("[venicestats-mcp] POST /mcp error:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // GET /mcp — SSE stream for server-initiated notifications (not used in stateless mode)
  app.get("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST for stateless mode." },
      id: null,
    });
  });

  // DELETE /mcp — session termination (not used in stateless mode)
  app.delete("/mcp", (_req, res) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Stateless server has no sessions." },
      id: null,
    });
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", tools: 20, version: "0.3.0" });
  });

  app.listen(port, () => {
    console.error(`[venicestats-mcp] HTTP transport listening on port ${port}`);
  });

  return true;
}

main().catch((err) => {
  console.error("[venicestats-mcp] Fatal:", err);
  process.exit(1);
});
