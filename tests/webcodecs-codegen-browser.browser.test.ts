/**
 * @file webcodecs-codegen-browser.browser.test.ts
 *
 * Tests the `WebCodecsCodeGenerator` in a **real Chromium browser context**.
 *
 * The code generator itself is pure TypeScript with no runtime browser API
 * calls, so these tests verify that:
 *   1. The module loads correctly in a browser module graph (no Node-only shims).
 *   2. All DSL → plan translations are correct when running in the browser.
 *   3. The generator integrates cleanly with the browser entry-point imports.
 *
 * The logic assertions mirror `webcodecs-codegen.test.ts` (node side) to give
 * confidence that both environments produce identical output.
 */

import { describe, it, expect } from "vitest";
import { lexer } from "../src/lexer.js";
import { parseTokens } from "../src/parser.js";
import { buildIR } from "../src/ir/analyzer.js";
import { WebCodecsCodeGenerator } from "../src/targets/webcodecs/codegen.js";
import { CompilerError } from "../src/errors.js";
import { compileTarget } from "../src/index.js";

describe("WebCodecs Code Generator (browser environment)", () => {
    // ── Basic plan generation ───────────────────────────────────────────────

    it("generates a valid WebCodecsPipelinePlan in a browser context", () => {
        const source = `
            input "video.mp4"
            resize 1280x720
            fps 30
            encode h264 aac
            bitrate 2M
            output "output.mp4"
        `;
        const ast = parseTokens(lexer(source));
        const ir = buildIR(ast);
        const generator = new WebCodecsCodeGenerator();
        const output = generator.generate(ir);

        expect(output.target).toBe("webcodecs");
        expect(output.plan.outputs).toHaveLength(1);

        const out = output.plan.outputs[0]!;
        expect(out.filename).toBe("output.mp4");
        expect(out.container).toBe("mp4");
        expect(out.video?.codec).toBe("avc");
        expect(out.video?.width).toBe(1280);
        expect(out.video?.height).toBe(720);
        expect(out.video?.frameRate).toBe(30);
        expect(out.video?.bitrateBps).toBe(2_000_000);
        expect(out.video?.hardwareAcceleration).toBe("prefer-software");
        expect(out.audio?.codec).toBe("aac");
    });

    // ── Video codec mapping ─────────────────────────────────────────────────

    it("correctly maps all supported DSL video codecs to mediabunny/WebCodecs strings", () => {
        const cases: Array<{ dslCodec: string; expected: string }> = [
            { dslCodec: "h264", expected: "avc" },
            { dslCodec: "h265", expected: "hevc" },
            { dslCodec: "vp8",  expected: "vp8" },
            { dslCodec: "vp9",  expected: "vp09" },
            { dslCodec: "av1",  expected: "av01" },
        ];

        for (const { dslCodec, expected } of cases) {
            const source = `
                input "video.mp4"
                encode ${dslCodec} aac
                output "output.mp4"
            `;
            const output = new WebCodecsCodeGenerator().generate(
                buildIR(parseTokens(lexer(source)))
            );
            expect(output.plan.outputs[0]?.video?.codec).toBe(expected);
        }
    });

    // ── Audio codec mapping ─────────────────────────────────────────────────

    it("correctly maps all supported DSL audio codecs", () => {
        const cases: Array<{ dslCodec: string; expected: string }> = [
            { dslCodec: "aac",    expected: "aac" },
            { dslCodec: "mp3",    expected: "mp3" },
            { dslCodec: "opus",   expected: "opus" },
            { dslCodec: "vorbis", expected: "vorbis" },
            { dslCodec: "flac",   expected: "flac" },
        ];

        for (const { dslCodec, expected } of cases) {
            const source = `
                input "video.mp4"
                encode h264 ${dslCodec}
                output "output.mp4"
            `;
            const output = new WebCodecsCodeGenerator().generate(
                buildIR(parseTokens(lexer(source)))
            );
            expect(output.plan.outputs[0]?.audio?.codec).toBe(expected);
        }
    });

    // ── Container validation ────────────────────────────────────────────────

    it("allows mp4 and webm containers", () => {
        for (const ext of ["mp4", "webm"] as const) {
            const source = `
                input "video.mp4"
                encode h264 aac
                output "output.${ext}"
            `;
            const output = new WebCodecsCodeGenerator().generate(
                buildIR(parseTokens(lexer(source)))
            );
            expect(output.plan.outputs[0]?.container).toBe(ext);
        }
    });

    it("throws CompilerError for unsupported containers (.avi, .mkv, .mov)", () => {
        for (const ext of ["avi", "mkv", "mov"]) {
            const source = `
                input "video.mp4"
                output "output.${ext}"
            `;
            expect(() => {
                new WebCodecsCodeGenerator().generate(
                    buildIR(parseTokens(lexer(source)))
                );
            }).toThrow(CompilerError);
        }
    });

    // ── Codec restriction errors ────────────────────────────────────────────

    it("throws CompilerError for unsupported video codec (mpeg2video)", () => {
        const source = `
            input "video.mp4"
            encode mpeg2video aac
            output "output.mp4"
        `;
        expect(() => {
            new WebCodecsCodeGenerator().generate(
                buildIR(parseTokens(lexer(source)))
            );
        }).toThrow(CompilerError);
    });

    it("throws CompilerError for unsupported audio codec (pcm_s16le)", () => {
        const source = `
            input "video.mp4"
            encode h264 pcm_s16le
            output "output.mp4"
        `;
        expect(() => {
            new WebCodecsCodeGenerator().generate(
                buildIR(parseTokens(lexer(source)))
            );
        }).toThrow(CompilerError);
    });

    it("throws CompilerError when V2 script is compiled to webcodecs target", () => {
        const source = `
            use v2
            source main "video.mp4"
            clip scene1 from main 0s to 10s
            timeline { scene1 }
            output "out.mp4"
        `;
        expect(() => {
            compileTarget(source, { target: "webcodecs" });
        }).toThrow(CompilerError);
    });

    // ── Audio-only / multi-output ───────────────────────────────────────────

    it("omits video config for audio-only input", () => {
        const source = `
            input "song.mp3"
            encode h264 aac
            output "song_out.mp4"
        `;
        const output = new WebCodecsCodeGenerator().generate(
            buildIR(parseTokens(lexer(source)))
        );
        expect(output.plan.outputs[0]?.video).toBeUndefined();
        expect(output.plan.outputs[0]?.audio?.codec).toBe("aac");
    });

    it("handles multiple outputs with per-output overrides", () => {
        const source = `
            input "video.mp4"
            resize 1280x720
            encode h264 aac

            output "low.mp4" {
                resize 640x360
                bitrate 500k
            }

            output "high.webm" {
                encode vp9 opus
                bitrate 4M
            }
        `;
        const output = new WebCodecsCodeGenerator().generate(
            buildIR(parseTokens(lexer(source)))
        );

        expect(output.plan.outputs).toHaveLength(2);

        const out1 = output.plan.outputs[0]!;
        expect(out1.filename).toBe("low.mp4");
        expect(out1.video?.width).toBe(640);
        expect(out1.video?.bitrateBps).toBe(500_000);

        const out2 = output.plan.outputs[1]!;
        expect(out2.filename).toBe("high.webm");
        expect(out2.video?.codec).toBe("vp09");
        expect(out2.video?.bitrateBps).toBe(4_000_000);
        expect(out2.audio?.codec).toBe("opus");
    });

    it("populates sourceVideoCodec and sourceAudioCodec on the plan", () => {
        const source = `
            input "video.mp4"
            encode h264 aac
            output "output.mp4"
        `;
        const output = new WebCodecsCodeGenerator().generate(
            buildIR(parseTokens(lexer(source)))
        );
        expect(output.plan.sourceVideoCodec).toBe("h264");
        expect(output.plan.sourceAudioCodec).toBe("aac");
    });

    // ── Thumbnail warning ───────────────────────────────────────────────────

    it("emits console.warn and sets plan.thumbnail for thumbnail steps", () => {
        const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const source = `
            input "video.mp4"
            thumbnail 5s
            output "output.mp4"
        `;
        const output = new WebCodecsCodeGenerator().generate(
            buildIR(parseTokens(lexer(source)))
        );

        expect(spy).toHaveBeenCalledWith(
            expect.stringContaining("Thumbnail extraction is not supported by the WebCodecs")
        );
        expect(output.plan.thumbnail).toEqual({ atSeconds: 5 });

        spy.mockRestore();
    });
});
