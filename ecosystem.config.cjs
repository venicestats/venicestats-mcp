module.exports = {
  apps: [
    {
      name: "venice-mcp",
      script: "dist/index.js",
      args: "--http",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        PORT: 3333,
        // Bypass Cloudflare on self-requests — MUST point at the local Next
        // server, not venicestats.com (CF returns 403 on self-IP fetches).
        // See gotchas.md "Prod MCP calls localhost".
        VENICESTATS_API_URL: "http://localhost:6969",
      },
      kill_timeout: 5000,
      max_memory_restart: "200M",
    },
  ],
};
