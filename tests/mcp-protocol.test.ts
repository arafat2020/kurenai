/**
 * Speaks MCP over stdio to the real server (tsx src/mcp/server.ts),
 * the same shape Cursor and Claude Desktop launch.
 */
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const root = join(import.meta.dirname, "..");
const tsxCli = join(root, "node_modules", "tsx", "dist", "cli.mjs");

function textOf(result: { content?: { type: string; text?: string }[]; isError?: boolean }): string {
    return (result.content ?? []).map((part) => part.text ?? "").join("\n");
}

describe("Kurenai MCP server over stdio", () => {
    let client: Client;
    let transport: StdioClientTransport;
    const stderr: string[] = [];

    beforeAll(async () => {
        transport = new StdioClientTransport({
            command: process.execPath,
            args: [tsxCli, join(root, "src", "mcp", "server.ts")],
            cwd: root,
            stderr: "pipe",
        });
        transport.stderr?.on("data", (chunk: Buffer | string) => {
            stderr.push(String(chunk));
        });
        client = new Client({ name: "kurenai-mcp-test", version: "1.0.0" });
        await client.connect(transport);
    }, 30_000);

    afterAll(async () => {
        await client?.close();
    });

    it("announces the kurenai server and the tool + resource capabilities", () => {
        const version = client.getServerVersion();
        expect(version?.name).toBe("kurenai");
        expect(version?.version).toBe("2.2.0-beta.1");
        const caps = client.getServerCapabilities();
        expect(caps?.tools).toBeDefined();
        expect(caps?.resources).toBeDefined();
    });

    it("lists the five outcome tools and no extra shell tool", async () => {
        const listed = await client.listTools();
        const names = listed.tools.map((tool) => tool.name).sort();
        expect(names).toEqual([
            "kurenai_compile",
            "kurenai_explain",
            "kurenai_run",
            "kurenai_scaffold",
            "kurenai_validate",
        ]);
        for (const tool of listed.tools) {
            expect(tool.description && tool.description.length > 20).toBe(true);
            expect(tool.inputSchema.type).toBe("object");
        }
        expect(names.join(" ")).not.toMatch(/shell|ffmpeg_raw|exec/);
    });

    it("marks compile/validate/explain/scaffold read-only and run destructive", async () => {
        const listed = await client.listTools();
        const byName = Object.fromEntries(listed.tools.map((tool) => [tool.name, tool]));
        for (const name of ["kurenai_compile", "kurenai_validate", "kurenai_explain", "kurenai_scaffold"]) {
            expect(byName[name]?.annotations?.readOnlyHint, name).toBe(true);
        }
        expect(byName.kurenai_run?.annotations?.readOnlyHint).toBe(false);
        expect(byName.kurenai_run?.annotations?.destructiveHint).toBe(true);
    });

    it("compiles the chat-edit story through the protocol", async () => {
        const result = await client.callTool({
            name: "kurenai_compile",
            arguments: {
                source: `
input "talk.mp4"
resize 1280x720
audio {
  normalize -14 LUFS
}
watermark "logo.png" bottom-right
encode h264 aac
crf 23
preset medium
output "talk_out.mp4"
`,
                target: "ffmpeg",
            },
        });
        expect(result.isError).not.toBe(true);
        const text = textOf(result);
        expect(text).toContain("scale=1280:720");
        expect(text).toContain("loudnorm=I=-14");
        expect(text).toContain("talk_out.mp4");
    });

    it("returns a structured validate error for a bad script", async () => {
        const result = await client.callTool({
            name: "kurenai_validate",
            arguments: { source: `input "x.mp4"\nresize nope\noutput "o.mp4"` },
        });
        expect(result.isError).toBe(true);
        expect(textOf(result)).toContain("Error on line 2:");
    });

    it("dry-runs by default", async () => {
        const result = await client.callTool({
            name: "kurenai_run",
            arguments: { source: `input "a.mp4"\noutput "b.mp4"` },
        });
        expect(result.isError).not.toBe(true);
        const body = JSON.parse(textOf(result));
        expect(body.dryRun).toBe(true);
        expect(body.commands[0]).toContain("ffmpeg");
    });

    it("rejects an unknown scaffold intent as a tool error, not a raw shell call", async () => {
        const result = await client.callTool({
            name: "kurenai_scaffold",
            arguments: { intent: "burn_subtitles" },
        });
        expect(result.isError).toBe(true);
        const text = textOf(result);
        expect(text).toMatch(/Invalid enum value/);
        expect(text).toContain("gif_ready");
        expect(text).not.toContain("ffmpeg");
    });

    it("serves the DSL reference resource", async () => {
        const listed = await client.listResources();
        expect(listed.resources.map((item) => item.uri)).toContain("kurenai://docs/dsl");
        const resource = listed.resources.find((item) => item.uri === "kurenai://docs/dsl");
        expect(resource?.mimeType).toBe("text/markdown");

        const read = await client.readResource({ uri: "kurenai://docs/dsl" });
        const text = read.contents.map((part) => ("text" in part ? part.text : "")).join("\n");
        expect(text).toMatch(/normalize -14 LUFS/);
        expect(text).toMatch(/execute=true/);
    });

    it("compiles a .crn file path passed by the client", async () => {
        const dir = mkdtempSync(join(tmpdir(), "kurenai-mcp-file-"));
        const file = join(dir, "pod.crn");
        try {
            writeFileSync(
                file,
                `input "episode.wav"\naudio {\n  normalize -14 LUFS\n  codec aac\n  bitrate 192k\n}\noutput "master.m4a"\n`,
            );
            const result = await client.callTool({
                name: "kurenai_compile",
                arguments: { file },
            });
            expect(result.isError).not.toBe(true);
            expect(textOf(result)).toContain("loudnorm=I=-14");
            expect(textOf(result)).toContain("episode.wav");
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });

    it("does not write protocol logs onto stderr during a successful call", () => {
        const noise = stderr.join("");
        expect(noise).not.toMatch(/Kurenai MCP server failed/);
        expect(noise).not.toMatch(/Error/);
    });
});
