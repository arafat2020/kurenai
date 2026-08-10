/**
 * @file webcodecs-browser-entry.browser.test.ts
 *
 * Integration tests for the `@arafat2020/kurenai/browser` entry point
 * running in a **real Chromium browser** via Vitest Browser Mode.
 *
 * These tests exercise the complete round-trip:
 *   DSL source → compileTarget() → WebCodecsOutput → checkWebCodecsCapability()
 *
 * Key things that differ from the Node.js equivalent (browser-entry.test.ts):
 *   - `detectEnvironment()` returns "browser" because `window.document` exists
 *   - `checkWebCodecsCapability()` uses the native VideoEncoder / AudioEncoder
 *   - `compileTarget()` with `{ target: "auto" }` resolves to "webcodecs"
 */

import { describe, it, expect } from "vitest";
import {
    compileTarget,
    checkWebCodecsCapability,
    executeWebCodecsPipeline,
    buildIR,
    detectEnvironment,
    resolveTarget,
} from "../src/browser.js";

// ── Export surface ────────────────────────────────────────────────────────────

describe("Browser Entry Point Exports (browser environment)", () => {
    it("re-exports core compiler functions from index.js", () => {
        expect(typeof compileTarget).toBe("function");
        expect(typeof buildIR).toBe("function");
        expect(typeof detectEnvironment).toBe("function");
        expect(typeof resolveTarget).toBe("function");
    });

    it("exports browser-specific execution and capability utilities", () => {
        expect(typeof checkWebCodecsCapability).toBe("function");
        expect(typeof executeWebCodecsPipeline).toBe("function");
    });
});

// ── Environment detection ─────────────────────────────────────────────────────

describe("detectEnvironment() in a real browser", () => {
    it("returns 'browser' because window.document exists in Chromium", () => {
        // This is the key difference from the Node.js test: no monkey-patching needed
        expect(detectEnvironment()).toBe("browser");
    });

    it("window is defined and has a document property", () => {
        expect(typeof window).toBe("object");
        expect(typeof window.document).toBe("object");
    });
});

// ── Target resolution ─────────────────────────────────────────────────────────

describe("resolveTarget() in a real browser", () => {
    it("auto-resolves to 'webcodecs' in a browser context", () => {
        expect(resolveTarget({})).toBe("webcodecs");
        expect(resolveTarget({ target: "auto" })).toBe("webcodecs");
    });

    it("respects explicit 'ffmpeg' override even in browser context", () => {
        expect(resolveTarget({ target: "ffmpeg" })).toBe("ffmpeg");
    });

    it("respects explicit 'webcodecs' override in browser context", () => {
        expect(resolveTarget({ target: "webcodecs" })).toBe("webcodecs");
    });
});

// ── compileTarget() integration ───────────────────────────────────────────────

describe("compileTarget() in a real browser", () => {
    it("auto-selects webcodecs target in browser environment", () => {
        const source = `
            input "input.mp4"
            resize 1280x720
            encode h264 aac
            output "output.mp4"
        `;
        const result = compileTarget(source);
        // In a real browser, auto-detection → webcodecs
        expect(result.target).toBe("webcodecs");
    });

    it("returns a well-formed WebCodecsPipelinePlan with correct shape", () => {
        const source = `
            input "video.mp4"
            resize 1920x1080
            fps 60
            encode h264 aac
            bitrate 4M
            output "out.mp4"
        `;
        const result = compileTarget(source, { target: "webcodecs" });

        expect(result.target).toBe("webcodecs");
        if (result.target === "webcodecs") {
            const plan = result.plan;
            expect(plan.outputs).toHaveLength(1);
            const out = plan.outputs[0]!;
            expect(out.filename).toBe("out.mp4");
            expect(out.container).toBe("mp4");
            expect(out.video?.codec).toBe("avc");
            expect(out.video?.width).toBe(1920);
            expect(out.video?.height).toBe(1080);
            expect(out.video?.frameRate).toBe(60);
            expect(out.video?.bitrateBps).toBe(4_000_000);
            expect(out.audio?.codec).toBe("aac");
        }
    });

    it("explicit { target: 'ffmpeg' } still works in browser context", () => {
        const source = `
            input "video.mp4"
            encode h264 aac
            output "output.mp4"
        `;
        const result = compileTarget(source, { target: "ffmpeg" });
        expect(result.target).toBe("ffmpeg");
        if (result.target === "ffmpeg") {
            expect(Array.isArray(result.commands)).toBe(true);
            expect(result.commands.length).toBeGreaterThan(0);
        }
    });
});

// ── Full round-trip: compile → capability check ───────────────────────────────

describe("compile → capability check round-trip (browser environment)", () => {
    it("compileTarget() + checkWebCodecsCapability() succeeds for vp9+opus", async () => {
        const source = `
            input "input.webm"
            resize 1280x720
            encode vp9 opus
            output "output.webm"
        `;
        const result = compileTarget(source, { target: "webcodecs" });
        expect(result.target).toBe("webcodecs");

        if (result.target === "webcodecs") {
            const cap = await checkWebCodecsCapability(result.plan);
            expect(cap).toBeDefined();
            expect(typeof cap.supported).toBe("boolean");
            // Chromium supports vp9 and opus across all OS platforms (including Linux CI)
            expect(cap.supported).toBe(true);
        }
    });

    it("checkWebCodecsCapability() uses native VideoEncoder/AudioEncoder (no mock)", async () => {
        // Verify the native globals actually exist in our browser context
        expect(typeof VideoEncoder).toBe("function");
        expect(typeof AudioEncoder).toBe("function");

        const source = `
            input "clip.mp4"
            encode vp9 opus
            output "out.webm"
        `;
        const result = compileTarget(source, { target: "webcodecs" });
        if (result.target === "webcodecs") {
            const cap = await checkWebCodecsCapability(result.plan);
            // Both vp9 and opus are supported in Chromium
            expect(cap.supported).toBe(true);
        }
    });

    it("returns supported:false for an unknown codec from the plan level", async () => {
        // Build a plan manually with an invalid codec string
        const plan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4" as const,
                    video: { codec: "completely_invalid_codec_string" },
                },
            ],
        };
        const cap = await checkWebCodecsCapability(plan);
        expect(cap.supported).toBe(false);
    });

    it("buildIR is re-exported and usable in the browser context", async () => {
        // buildIR is a Node-side compiler function that should work fine in browser too
        const { lexer } = await import("../src/lexer.js");
        const { parseTokens } = await import("../src/parser.js");

        const source = `
            input "video.mp4"
            encode h264 aac
            output "out.mp4"
        `;
        const ir = buildIR(parseTokens(lexer(source)));
        expect(ir).toBeDefined();
        expect(ir.isV2).toBe(false);
        expect(ir.outputs).toHaveLength(1);
    });
});
