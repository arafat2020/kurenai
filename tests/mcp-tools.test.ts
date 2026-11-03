import { describe, it, expect } from "vitest";
import {
    toolCompile,
    toolValidate,
    toolExplain,
    toolScaffold,
    toolRun,
} from "../src/mcp/tools.js";

const goodScript = `
input "video.mp4"
resize 1280x720
encode h264 aac
crf 23
preset medium
output "out.mp4"
`;

describe("MCP tool handlers", () => {
    it("kurenai_compile returns ffmpeg commands", () => {
        const res = toolCompile({ source: goodScript });
        expect(res.ok).toBe(true);
        expect(res.content).toContain("ffmpeg");
        expect(res.content).toContain("-crf 23");
    });

    it("kurenai_validate accepts good scripts and rejects bad ones", () => {
        expect(toolValidate({ source: goodScript }).ok).toBe(true);
        const bad = toolValidate({ source: `input "x.mp4"\nresize nope\noutput "o.mp4"` });
        expect(bad.ok).toBe(false);
        expect(bad.isError).toBe(true);
    });

    it("kurenai_explain returns explanation text", () => {
        const res = toolExplain({ source: goodScript });
        expect(res.ok).toBe(true);
        expect(res.content).toMatch(/resize|codec|output/i);
    });

    it("kurenai_scaffold intents are valid", () => {
        for (const intent of [
            "resize",
            "podcast",
            "watermark",
            "trim",
            "mute",
            "rotate",
            "gif_ready",
            "quality",
        ] as const) {
            const res = toolScaffold({ intent });
            expect(res.ok, intent).toBe(true);
            const parsed = JSON.parse(res.content);
            expect(parsed.source).toContain("input");
            expect(toolValidate({ source: parsed.source }).ok).toBe(true);
        }
    });

    it("kurenai_run defaults to dry-run", () => {
        const res = toolRun({ source: goodScript });
        expect(res.ok).toBe(true);
        const body = JSON.parse(res.content);
        expect(body.dryRun).toBe(true);
        expect(body.commands[0]).toContain("ffmpeg");
    });
});
