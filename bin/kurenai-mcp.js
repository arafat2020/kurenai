#!/usr/bin/env node
/**
 * Stable bin entry for the Kurenai MCP server.
 * Requires a prior `npm run build` so dist/mcp/server.js exists.
 */
const { existsSync } = require("node:fs");
const { join } = require("node:path");

const serverPath = join(__dirname, "..", "dist", "mcp", "server.js");

if (!existsSync(serverPath)) {
    console.error(
        [
            "Kurenai MCP server is not built.",
            "Run:  npm install && npm run build",
            "Then:  npx kurenai-mcp",
            "",
            "For local TypeScript without building:  npm run mcp",
        ].join("\n"),
    );
    process.exit(1);
}

require(serverPath);
