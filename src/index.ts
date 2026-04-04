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
  });

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", tools: 18, version: "0.1.0" });
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
