import { describe, it, expect, vi } from "vitest";
import { lexer } from "../src/lexer.js";
import { parseTokens } from "../src/parser.js";
import { buildIR } from "../src/ir/analyzer.js";
import { WebCodecsCodeGenerator } from "../src/targets/webcodecs/codegen.js";
import { CompilerError } from "../src/errors.js";
import { compileTarget } from "../src/index.js";

describe("WebCodecs Code Generator", () => {
    it("generates a valid WebCodecsPipelinePlan for V1 script", () => {
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

        const outPlan = output.plan.outputs[0]!;
        expect(outPlan.filename).toBe("output.mp4");
        expect(outPlan.container).toBe("mp4");
        expect(outPlan.video?.codec).toBe("avc");
        expect(outPlan.video?.width).toBe(1280);
        expect(outPlan.video?.height).toBe(720);
        expect(outPlan.video?.frameRate).toBe(30);
        expect(outPlan.video?.bitrateBps).toBe(2_000_000);
        expect(outPlan.video?.hardwareAcceleration).toBe("prefer-software");
        expect(outPlan.audio?.codec).toBe("aac");
    });

    it("correctly maps all supported video codecs to Mediabunny/WebCodecs strings", () => {
        const testCases = [
            { dslCodec: "h264", expected: "avc" },
            { dslCodec: "h265", expected: "hevc" },
            { dslCodec: "vp8",  expected: "vp8" },
            { dslCodec: "vp9",  expected: "vp09" },
            { dslCodec: "av1",  expected: "av01" },
        ];

        for (const { dslCodec, expected } of testCases) {
            const source = `
                input "video.mp4"
                encode ${dslCodec} aac
                output "output.mp4"
            `;
            const ast = parseTokens(lexer(source));
            const ir = buildIR(ast);
            const generator = new WebCodecsCodeGenerator();
            const output = generator.generate(ir);

            expect(output.plan.outputs[0]?.video?.codec).toBe(expected);
        }
    });

    it("correctly maps supported audio codecs", () => {
        const testCases = [
            { dslCodec: "aac",    expected: "aac" },
            { dslCodec: "mp3",    expected: "mp3" },
            { dslCodec: "opus",   expected: "opus" },
            { dslCodec: "vorbis", expected: "vorbis" },
            { dslCodec: "flac",   expected: "flac" },
        ];

        for (const { dslCodec, expected } of testCases) {
            const source = `
                input "video.mp4"
                encode h264 ${dslCodec}
                output "output.mp4"
            `;
            const ast = parseTokens(lexer(source));
            const ir = buildIR(ast);
            const generator = new WebCodecsCodeGenerator();
            const output = generator.generate(ir);

            expect(output.plan.outputs[0]?.audio?.codec).toBe(expected);
        }
    });

    it("throws CompilerError when V2 script is targeted to WebCodecs", () => {
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

    it("throws CompilerError for unsupported video codec in WebCodecs", () => {
        const source = `
            input "video.mp4"
            encode mpeg2video aac
            output "output.mp4"
        `;
        const ast = parseTokens(lexer(source));
        const ir = buildIR(ast);
        const generator = new WebCodecsCodeGenerator();

        expect(() => {
            generator.generate(ir);
        }).toThrow(CompilerError);
    });

    it("throws CompilerError for unsupported audio codec in WebCodecs", () => {
        const source = `
            input "video.mp4"
            encode h264 pcm_s16le
            output "output.mp4"
        `;
        const ast = parseTokens(lexer(source));
        const ir = buildIR(ast);
        const generator = new WebCodecsCodeGenerator();

        expect(() => {
            generator.generate(ir);
        }).toThrow(CompilerError);
    });

    it("throws CompilerError for unsupported output containers (e.g. .avi, .mkv)", () => {
        const source = `
            input "video.mp4"
            output "output.avi"
        `;
        const ast = parseTokens(lexer(source));
        const ir = buildIR(ast);
        const generator = new WebCodecsCodeGenerator();

        expect(() => {
            generator.generate(ir);
        }).toThrow(CompilerError);
    });

    it("handles audio-only input without emitting video config in plan", () => {
        const source = `
            input "song.mp3"
            encode h264 aac
            output "song_out.mp4"
        `;
        const ast = parseTokens(lexer(source));
        const ir = buildIR(ast);
        const generator = new WebCodecsCodeGenerator();
        const output = generator.generate(ir);

        expect(output.plan.outputs[0]?.video).toBeUndefined();
        expect(output.plan.outputs[0]?.audio?.codec).toBe("aac");
    });

    it("handles multiple output blocks and per-output overrides in WebCodecs plan", () => {
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
        const ast = parseTokens(lexer(source));
        const ir = buildIR(ast);
        const generator = new WebCodecsCodeGenerator();
        const output = generator.generate(ir);

        expect(output.plan.outputs).toHaveLength(2);

        const out1 = output.plan.outputs[0]!;
        expect(out1.filename).toBe("low.mp4");
        expect(out1.container).toBe("mp4");
        expect(out1.video?.width).toBe(640);
        expect(out1.video?.height).toBe(360);
        expect(out1.video?.bitrateBps).toBe(500_000);

        const out2 = output.plan.outputs[1]!;
        expect(out2.filename).toBe("high.webm");
        expect(out2.container).toBe("webm");
        expect(out2.video?.codec).toBe("vp09");
        expect(out2.video?.bitrateBps).toBe(4_000_000);
        expect(out2.audio?.codec).toBe("opus");
    });

    it("emits console warning for thumbnail extraction step and sets plan thumbnail property", () => {
        const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const source = `
            input "video.mp4"
            thumbnail 5s
            output "output.mp4"
        `;
        const ast = parseTokens(lexer(source));
        const ir = buildIR(ast);
        const generator = new WebCodecsCodeGenerator();
        const output = generator.generate(ir);

        expect(consoleWarnSpy).toHaveBeenCalledWith(
            expect.stringContaining("Thumbnail extraction is not supported by the WebCodecs")
        );
        expect(output.plan.thumbnail).toEqual({ atSeconds: 5 });

        consoleWarnSpy.mockRestore();
    });
});
