/**
 * Domain tests for the MCP problem in docs/mcp-usecase.md and docs/ffmpeg-gaps.md.
 *
 * Agents should not invent FFmpeg. They should scaffold or write Kurenai DSL,
 * validate, explain, compile, and only then dry-run or execute.
 * Assertions follow that contract. Failures are gaps in the MCP surface,
 * not loose style nits.
 */
import { mkdtempSync, writeFileSync, chmodSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, delimiter } from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import {
    toolCompile,
    toolValidate,
    toolExplain,
    toolScaffold,
    toolRun,
    DSL_REFERENCE,
} from "../src/mcp/tools.js";

const chatEdit = `
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
`;

const podcastMaster = `
input "episode.wav"
audio {
  normalize -14 LUFS
  codec aac
  bitrate 192k
}
output "master.m4a"
`;

function json(content: string): any {
    return JSON.parse(content);
}

describe("MCP story: edit from chat", () => {
    it("compiles resize + loudness + watermark into one FFmpeg command", () => {
        const res = toolCompile({ source: chatEdit });
        expect(res.ok).toBe(true);
        expect(res.isError).toBeUndefined();
        const body = json(res.content);
        expect(body.target).toBe("ffmpeg");
        expect(body.commands).toHaveLength(1);
        const cmd = body.commands[0] as string;
        expect(cmd.startsWith("ffmpeg ")).toBe(true);
        expect(cmd).toContain("-i talk.mp4");
        expect(cmd).toContain("scale=1280:720");
        expect(cmd).toContain("loudnorm=I=-14");
        expect(cmd).toContain("overlay=main_w-overlay_w-10:main_h-overlay_h-10");
        expect(cmd).toContain("-crf 23");
        expect(cmd).toContain("-preset medium");
        expect(cmd).toContain("talk_out.mp4");
        expect(cmd).not.toContain("&&");
        expect(cmd).not.toContain("|");
    });

    it("accepts the same script through validate before any run", () => {
        const res = toolValidate({ source: chatEdit });
        expect(res.ok).toBe(true);
        expect(json(res.content).valid).toBe(true);
    });
});

describe("MCP story: fix a broken pipeline", () => {
    it("returns a line/column caret the agent can patch against", () => {
        const source = `input "x.mp4"\nresize nope\noutput "o.mp4"`;
        const res = toolValidate({ source });
        expect(res.ok).toBe(false);
        expect(res.isError).toBe(true);
        expect(res.content).toContain("Error on line 2:");
        expect(res.content).toContain("resize nope");
        expect(res.content).toContain("^^^^");
        expect(res.content).toMatch(/1280x720/);
    });

    it("points at an unknown keyword instead of emitting a shell error", () => {
        const res = toolCompile({
            source: `input "a.mp4"\ndrawtext "hello"\noutput "b.mp4"`,
        });
        expect(res.ok).toBe(false);
        expect(res.isError).toBe(true);
        expect(res.content).toContain("Error on line 2:");
        expect(res.content).toMatch(/drawtext/);
        expect(res.content).not.toContain("ffmpeg ");
    });

    it("rejects a script that has neither source text nor a .crn file", () => {
        const res = toolCompile({});
        expect(res.ok).toBe(false);
        expect(res.content).toMatch(/source|file/);
    });
});

describe("MCP story: explain before run", () => {
    it("returns a summary and the command, and run stays a dry-run", () => {
        const explained = toolExplain({ source: chatEdit });
        expect(explained.ok).toBe(true);
        const body = json(explained.content);
        expect(body.explanation).toMatch(/talk\.mp4/);
        expect(body.explanation).toMatch(/1280x720/);
        expect(body.explanation).toMatch(/watermark/i);
        expect(body.commands[0]).toContain("ffmpeg");

        const dry = toolRun({ source: chatEdit });
        expect(dry.ok).toBe(true);
        expect(json(dry.content).dryRun).toBe(true);
        expect(json(dry.content).executed).toBeUndefined();
    });

    it("names loudness and quality in the prose summary, without printing undefined", () => {
        const body = json(toolExplain({ source: chatEdit }).content);
        const prose = String(body.explanation).split("FFmpeg command:")[0] ?? "";
        expect(prose).toMatch(/normalize|LUFS|loudnorm/i);
        expect(prose).toMatch(/crf|quality|23/);
        expect(body.explanation).not.toMatch(/undefined/);
    });

    it("shows the same command the dry-run would execute", () => {
        const compiled = json(toolCompile({ source: chatEdit }).content).commands;
        const dry = json(toolRun({ source: chatEdit }).content).commands;
        expect(dry).toEqual(compiled);
    });
});

describe("MCP story: podcast mastering", () => {
    it("compiles an audio-only loudness pipeline with no video filters", () => {
        const res = toolCompile({ source: podcastMaster });
        expect(res.ok).toBe(true);
        const cmd = json(res.content).commands[0] as string;
        expect(cmd).toContain("-i episode.wav");
        expect(cmd).toContain("loudnorm=I=-14");
        expect(cmd).toContain("-c:a aac");
        expect(cmd).toMatch(/-b:a (192k|192000)/);
        expect(cmd).toContain("master.m4a");
        expect(cmd).not.toContain("-vf");
        expect(cmd).not.toContain("scale=");
    });

    it("scaffolds a podcast script that keeps the caller's filenames", () => {
        const res = toolScaffold({
            intent: "podcast",
            input: "episode.wav",
            output: "master.m4a",
        });
        expect(res.ok).toBe(true);
        const source = json(res.content).source as string;
        expect(source).toContain('input "episode.wav"');
        expect(source).toContain('output "master.m4a"');
        expect(source).toMatch(/normalize -14 LUFS/);
        expect(toolValidate({ source }).ok).toBe(true);
        const compiled = json(toolCompile({ source }).content).commands[0] as string;
        expect(compiled).toContain("episode.wav");
        expect(compiled).toContain("master.m4a");
    });

    it("scaffolds podcast defaults when no filenames are given", () => {
        const res = toolScaffold({ intent: "podcast" });
        expect(res.ok).toBe(true);
        const source = json(res.content).source as string;
        expect(source).toContain("input ");
        expect(source).toContain("output ");
        expect(toolValidate({ source }).ok).toBe(true);
    });
});

describe("MCP story: teach FFmpeg from a known-good scaffold", () => {
    it("keeps the caller's output name on gif_ready", () => {
        const res = toolScaffold({
            intent: "gif_ready",
            input: "clip.mov",
            output: "preview.mp4",
        });
        expect(res.ok).toBe(true);
        const source = json(res.content).source as string;
        expect(source).toContain('input "clip.mov"');
        expect(source).toContain('output "preview.mp4"');
        expect(toolCompile({ source }).ok).toBe(true);
    });

    it("covers the supported V1 intents with commands an agent can show", () => {
        const cases: { source: string; includes: string[] }[] = [
            {
                source: `input "a.mp4"\nresize 1280x720\nfps 30\noutput "b.mp4"`,
                includes: ["scale=1280:720", "fps=30"],
            },
            {
                source: `input "a.mp4"\ntrim 10s 60s\noutput "b.mp4"`,
                includes: ["-ss 10", "-to 60"],
            },
            {
                source: `input "a.mp4"\nmute\noutput "b.mp4"`,
                includes: ["-an"],
            },
            {
                source: `input "a.mp4"\nrotate 90\nflip horizontal\noutput "b.mp4"`,
                includes: ["transpose=1", "hflip"],
            },
            {
                source: `input "a.mp4"\ncrop 640x360 10 20\noutput "b.mp4"`,
                includes: ["crop=640:360:10:20"],
            },
            {
                source: `input "a.mp4"\nspeed 1.5\noutput "b.mp4"`,
                includes: ["setpts=", "atempo=1.5"],
            },
            {
                source: `input "a.mp4"\nthumbnail 5s\noutput "b.mp4"`,
                includes: ["-ss 5", "-frames:v 1", "thumb.jpg"],
            },
        ];

        for (const item of cases) {
            const res = toolCompile({ source: item.source });
            expect(res.ok, item.source).toBe(true);
            const commands = (json(res.content).commands as string[]).join("\n");
            for (const needle of item.includes) {
                expect(commands, needle).toContain(needle);
            }
        }
    });
});

describe("MCP story: dual target", () => {
    it("returns a WebCodecs plan with the resize and codec from the script", () => {
        const res = toolCompile({
            source: `input "a.mp4"\nresize 1280x720\nencode h264 aac\noutput "b.mp4"`,
            target: "webcodecs",
        });
        expect(res.ok).toBe(true);
        const plan = json(res.content).plan;
        expect(json(res.content).target).toBe("webcodecs");
        expect(plan.outputs[0].container).toBe("mp4");
        expect(plan.outputs[0].video.codec).toBe("avc");
        expect(plan.outputs[0].video.width).toBe(1280);
        expect(plan.outputs[0].video.height).toBe(720);
        expect(plan.outputs[0].audio.codec).toBe("aac");
    });

    it("keeps resize on a WebCodecs plan even when the script has no encode line", () => {
        const res = toolCompile({
            source: `input "a.mp4"\nresize 640x360\nfps 24\noutput "b.mp4"`,
            target: "webcodecs",
        });
        expect(res.ok).toBe(true);
        const video = json(res.content).plan.outputs[0].video;
        expect(video.width).toBe(640);
        expect(video.height).toBe(360);
        expect(video.frameRate).toBe(24);
    });

    it("refuses WebCodecs for a container it cannot mux", () => {
        const res = toolCompile({
            source: `input "a.mp4"\nencode h264 aac\noutput "b.mkv"`,
            target: "webcodecs",
        });
        expect(res.ok).toBe(false);
        expect(res.isError).toBe(true);
        expect(res.content).toMatch(/webcodecs|container|mp4/i);
    });

    it("applies CLI trim overrides on the FFmpeg target", () => {
        const res = toolCompile({
            source: `input "a.mp4"\noutput "b.mp4"`,
            start: 2,
            end: 8,
        });
        const cmd = json(res.content).commands[0] as string;
        expect(cmd).toContain("-ss 2");
        expect(cmd).toContain("-to 8");
    });
});

describe("MCP story: V2 timeline", () => {
    const v2 = `use v2
source intro "intro.mp4"
source main "main.mp4"
clip c_intro from intro 0s to 5s
clip c_main from main 1s to 9s
timeline {
  c_intro
  c_main
}
encode h264 aac
output "final.mp4"
`;

    it("validates a timeline script", () => {
        expect(toolValidate({ source: v2 }).ok).toBe(true);
    });

    it("compiles the timeline into segment and concat commands, not a single first-source copy", () => {
        const res = toolCompile({ source: v2 });
        expect(res.ok).toBe(true);
        const commands = (json(res.content).commands as string[]).join("\n");
        expect(commands).toContain("intro.mp4");
        expect(commands).toContain("main.mp4");
        expect(commands).toMatch(/concat|segment_c_intro|segment_c_main/);
        expect(commands).not.toBe("ffmpeg -i intro.mp4 -c:v libx264 -c:a aac final.mp4");
    });

    it("tells the agent that WebCodecs cannot run a V2 script", () => {
        const res = toolCompile({ source: v2, target: "webcodecs" });
        expect(res.ok).toBe(false);
        expect(res.content).toMatch(/V2|webcodecs/i);
    });
});

describe("MCP story: multi-output and file input", () => {
    it("emits one command per output block", () => {
        const res = toolCompile({
            source: `input "a.mp4"\noutput "one.mp4"\noutput "two.mp4"`,
        });
        const commands = json(res.content).commands as string[];
        expect(commands).toHaveLength(2);
        expect(commands[0]).toContain("one.mp4");
        expect(commands[1]).toContain("two.mp4");
    });

    it("reads a .crn file and rejects other extensions and missing files", () => {
        const dir = mkdtempSync(join(tmpdir(), "kurenai-crn-"));
        const file = join(dir, "edit.crn");
        try {
            writeFileSync(file, `input "a.mp4"\nresize 1280x720\noutput "b.mp4"\n`);
            const res = toolCompile({ file });
            expect(res.ok).toBe(true);
            expect(json(res.content).commands[0]).toContain("scale=1280:720");

            const badExt = toolCompile({ file: join(dir, "notes.txt") });
            expect(badExt.ok).toBe(false);
            expect(badExt.content).toMatch(/\.crn/);

            const missing = toolValidate({ file: join(dir, "missing.crn") });
            expect(missing.ok).toBe(false);
            expect(missing.content).toMatch(/not found/i);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe("MCP story: run is opt-in and cwd-scoped", () => {
    const envBackup: { PATH?: string; KURENAI_FAKE_FFMPEG_LOG?: string } = {};
    let fakeDir: string | undefined;

    afterEach(() => {
        if (envBackup.PATH === undefined) delete process.env.PATH;
        else process.env.PATH = envBackup.PATH;
        if (envBackup.KURENAI_FAKE_FFMPEG_LOG === undefined) delete process.env.KURENAI_FAKE_FFMPEG_LOG;
        else process.env.KURENAI_FAKE_FFMPEG_LOG = envBackup.KURENAI_FAKE_FFMPEG_LOG;
        if (fakeDir) rmSync(fakeDir, { recursive: true, force: true });
        fakeDir = undefined;
    });

    function installFakeFfmpeg(scriptBody: string): string {
        envBackup.PATH = process.env.PATH;
        envBackup.KURENAI_FAKE_FFMPEG_LOG = process.env.KURENAI_FAKE_FFMPEG_LOG;
        fakeDir = mkdtempSync(join(tmpdir(), "kurenai-ffmpeg-"));
        const log = join(fakeDir, "log.txt");
        const bin = join(fakeDir, "ffmpeg");
        writeFileSync(bin, `#!/bin/sh\n${scriptBody}\n`);
        chmodSync(bin, 0o755);
        process.env.KURENAI_FAKE_FFMPEG_LOG = log;
        process.env.PATH = `${fakeDir}${delimiter}${process.env.PATH ?? ""}`;
        return log;
    }

    it("does not execute FFmpeg on the default dry-run", () => {
        const log = installFakeFfmpeg('echo executed >> "$KURENAI_FAKE_FFMPEG_LOG"');
        const res = toolRun({ source: `input "a.mp4"\noutput "b.mp4"` });
        expect(json(res.content).dryRun).toBe(true);
        expect(existsSync(log)).toBe(false);
    });

    it("executes only the generated ffmpeg binary when execute=true", () => {
        const log = installFakeFfmpeg('printf "%s\\n" "$@" >> "$KURENAI_FAKE_FFMPEG_LOG"');
        const res = toolRun({
            source: `input "a.mp4"\noutput "b.mp4"`,
            execute: true,
        });
        expect(res.ok).toBe(true);
        const body = json(res.content);
        expect(body.dryRun).toBe(false);
        expect(body.executed[0]).toContain("OK:");
        expect(body.executed[0]).toContain("ffmpeg");
        const recorded = readFileSync(log, "utf-8");
        expect(recorded).toContain("-i");
        expect(recorded).toContain("a.mp4");
        expect(recorded).not.toContain("sh -c");
    });

    it("returns a tool error when FFmpeg exits non-zero", () => {
        installFakeFfmpeg("exit 3");
        const res = toolRun({
            source: `input "a.mp4"\noutput "b.mp4"`,
            execute: true,
        });
        expect(res.ok).toBe(false);
        expect(res.isError).toBe(true);
        expect(res.content.length).toBeGreaterThan(0);
    });

    it("refuses a relative path that leaves cwd", () => {
        const res = toolRun({ source: `input "../secret.mp4"\noutput "out.mp4"` });
        expect(res.ok).toBe(false);
        expect(res.content).toMatch(/outside cwd/i);
    });

    it("refuses an absolute path outside cwd", () => {
        const res = toolRun({ source: `input "/tmp/outside.mp4"\noutput "out.mp4"` });
        expect(res.ok).toBe(false);
        expect(res.content).toMatch(/outside cwd/i);
    });

    it("refuses a sibling directory whose path merely starts with cwd", () => {
        const outside = `${process.cwd()}-evil/x.mp4`;
        const res = toolRun({ source: `input "${outside}"\noutput "out.mp4"` });
        expect(res.ok).toBe(false);
        expect(res.content).toMatch(/outside cwd/i);
    });

    it("refuses an outside path that contains a space", () => {
        const res = toolRun({ source: `input "../evil/my file.mp4"\noutput "out.mp4"` });
        expect(res.ok).toBe(false);
        expect(res.content).toMatch(/outside cwd/i);
    });

    it("allows an outside path only when allowOutsideCwd is set", () => {
        const res = toolRun({
            source: `input "../secret.mp4"\noutput "out.mp4"`,
            allowOutsideCwd: true,
        });
        expect(res.ok).toBe(true);
        expect(json(res.content).dryRun).toBe(true);
        expect(json(res.content).commands[0]).toContain("../secret.mp4");
    });

    it("does not execute when the path check fails, even if execute=true", () => {
        const log = installFakeFfmpeg('echo executed >> "$KURENAI_FAKE_FFMPEG_LOG"');
        const res = toolRun({
            source: `input "../secret.mp4"\noutput "out.mp4"`,
            execute: true,
        });
        expect(res.ok).toBe(false);
        expect(existsSync(log)).toBe(false);
    });
});

describe("MCP resource: DSL reference", () => {
    it("teaches the repair loop the docs require", () => {
        expect(DSL_REFERENCE).toMatch(/input /);
        expect(DSL_REFERENCE).toMatch(/audio \{/);
        expect(DSL_REFERENCE).toMatch(/normalize -14 LUFS/);
        expect(DSL_REFERENCE).toMatch(/validate/);
        expect(DSL_REFERENCE).toMatch(/scaffold/);
        expect(DSL_REFERENCE).toMatch(/execute=true/);
        expect(DSL_REFERENCE).toMatch(/crf/);
    });
});
