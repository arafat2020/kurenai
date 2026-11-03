#!/usr/bin/env node
/**
 * Kurenai MCP server — exposes compile / validate / explain / scaffold / run
 * over stdio for Cursor, Claude Desktop, and other MCP clients.
 *
 * Does not modify the compiler core; tools call the public API in ../index.ts.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
    toolCompile,
    toolValidate,
    toolExplain,
    toolScaffold,
    toolRun,
    DSL_REFERENCE,
} from "./tools.js";

const sourceInput = {
    source: z.string().optional().describe("Raw Kurenai DSL script text"),
    file: z.string().optional().describe("Path to a .crn file (relative to cwd or absolute)"),
};

function textResult(result: { content: string; isError?: boolean }) {
    return {
        content: [{ type: "text" as const, text: result.content }],
        isError: result.isError === true,
    };
}

const server = new McpServer({
    name: "kurenai",
    version: "2.2.0-beta.1",
});

server.registerTool(
    "kurenai_compile",
    {
        description:
            "Compile a Kurenai DSL script into FFmpeg command(s) or a WebCodecs plan. Prefer this over writing raw FFmpeg flags.",
        inputSchema: {
            ...sourceInput,
            target: z.enum(["ffmpeg", "webcodecs"]).optional().describe("Compile target (default: ffmpeg)"),
            start: z.number().optional().describe("Optional trim start in seconds (CLI override)"),
            end: z.number().optional().describe("Optional trim end in seconds (CLI override)"),
        },
    },
    async (args) => textResult(toolCompile(args)),
);

server.registerTool(
    "kurenai_validate",
    {
        description:
            "Validate Kurenai DSL syntax and semantics. Returns structured line/column errors on failure.",
        inputSchema: sourceInput,
    },
    async (args) => textResult(toolValidate(args)),
);

server.registerTool(
    "kurenai_explain",
    {
        description:
            "Explain what a Kurenai script will do, plus the generated FFmpeg commands. Use before running.",
        inputSchema: sourceInput,
    },
    async (args) => textResult(toolExplain(args)),
);

server.registerTool(
    "kurenai_scaffold",
    {
        description:
            "Generate a known-valid starter .crn script for a common intent (resize, podcast, watermark, trim, mute, rotate, gif_ready, quality).",
        inputSchema: {
            intent: z.enum([
                "resize",
                "podcast",
                "watermark",
                "trim",
                "mute",
                "rotate",
                "gif_ready",
                "quality",
            ]),
            input: z.string().optional().describe("Input media filename"),
            output: z.string().optional().describe("Output media filename"),
        },
    },
    async (args) => textResult(toolScaffold(args)),
);

server.registerTool(
    "kurenai_run",
    {
        description:
            "Compile then optionally execute FFmpeg. Defaults to dry-run (execute=false). Only set execute=true with user consent. Paths must stay under cwd unless allowOutsideCwd=true.",
        inputSchema: {
            ...sourceInput,
            execute: z.boolean().optional().describe("Actually run FFmpeg (default false = dry-run)"),
            allowOutsideCwd: z
                .boolean()
                .optional()
                .describe("Allow input/output paths outside the current working directory"),
        },
    },
    async (args) => textResult(toolRun(args)),
);

server.registerResource(
    "kurenai-dsl-reference",
    "kurenai://docs/dsl",
    {
        description: "Quick reference for Kurenai DSL keywords useful to agents",
        mimeType: "text/markdown",
    },
    async () => ({
        contents: [
            {
                uri: "kurenai://docs/dsl",
                mimeType: "text/markdown",
                text: DSL_REFERENCE,
            },
        ],
    }),
);

async function main(): Promise<void> {
    const transport = new StdioServerTransport();
    await server.connect(transport);
}

main().catch((err) => {
    console.error("Kurenai MCP server failed:", err);
    process.exit(1);
});
