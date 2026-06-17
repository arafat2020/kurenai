import { describe, it, expect } from "vitest";
import { analyze } from "../src/analyzer";
import { Program, VideoCodec, AudioCodec, WatermarkPosition } from "../src/parser";

describe("analyzer", () => {
    const createBaseProgram = (overrides?: Partial<Program>): Program => {
        return {
            type: "PROGRAM",
            line: 1,
            column: 1,
            length: 0,
            input: { type: "INPUT", value: "video.mp4", line: 1, column: 7, length: 10 },
            output: { type: "OUTPUT", value: "out.mp4", line: 2, column: 8, length: 8 },
            profiles: {},
            ...overrides
        } as Program;
    };

    describe("analyzeInput", () => {
        it("should not throw on valid input format", () => {
            const code = createBaseProgram({
                input: { type: "INPUT", value: "video.mp4", line: 1, column: 7, length: 10 }
            });
            expect(() => analyze(code)).not.toThrow();
        });

        it("should throw if input is missing", () => {
            const code = createBaseProgram({ input: undefined as any });
            expect(() => analyze(code)).toThrow("Input file is missing.");
        });

        it("should throw on invalid input format", () => {
            const code = createBaseProgram({
                input: { type: "INPUT", value: "video.mp3", line: 1, column: 7, length: 10 }
            });
            expect(() => analyze(code)).toThrow("Unsupported input format: .mp3");
        });
    });

    describe("analyzeOutput", () => {
        it("should not throw on valid output format", () => {
            const code = createBaseProgram({
                output: { type: "OUTPUT", value: "out.mkv", line: 2, column: 8, length: 8 }
            });
            expect(() => analyze(code)).not.toThrow();
        });

        it("should throw if output is missing", () => {
            const code = createBaseProgram({ output: undefined as any });
            expect(() => analyze(code)).toThrow("Output file is missing.");
        });

        it("should throw on invalid output format", () => {
            const code = createBaseProgram({
                output: { type: "OUTPUT", value: "out.wav", line: 2, column: 8, length: 8 }
            });
            expect(() => analyze(code)).toThrow("Unsupported output format: .wav");
        });
    });

    describe("analyzeFps", () => {
        it("should not throw if fps is not provided", () => {
            const code = createBaseProgram();
            expect(() => analyze(code)).not.toThrow();
        });

        it("should not throw on valid fps", () => {
            const code = createBaseProgram({
                fps: { type: "FPS", value: 30, line: 3, column: 5, length: 2 }
            });
            expect(() => analyze(code)).not.toThrow();
        });

        it("should throw on negative or zero fps", () => {
            const code = createBaseProgram({
                fps: { type: "FPS", value: 0, line: 3, column: 5, length: 1 }
            });
            expect(() => analyze(code)).toThrow("Invalid FPS value: 0");
        });

        it("should throw on overly high fps", () => {
            const code = createBaseProgram({
                fps: { type: "FPS", value: 300, line: 3, column: 5, length: 3 }
            });
            expect(() => analyze(code)).toThrow("Invalid FPS value: 300");
        });
    });

    describe("analyzeResize", () => {
        it("should not throw if resize is not provided", () => {
            const code = createBaseProgram();
            expect(() => analyze(code)).not.toThrow();
        });

        it("should not throw on valid resize", () => {
            const code = createBaseProgram({
                resize: { type: "RESIZE", width: 1920, height: 1080, line: 3, column: 8, length: 9 }
            });
            expect(() => analyze(code)).not.toThrow();
        });

        it("should throw if width or height is <= 0", () => {
            const code = createBaseProgram({
                resize: { type: "RESIZE", width: 0, height: 1080, line: 3, column: 8, length: 6 }
            });
            expect(() => analyze(code)).toThrow("Invalid resize values: 0x1080");
        });

        it("should throw if width or height is not divisible by 2", () => {
            const code = createBaseProgram({
                resize: { type: "RESIZE", width: 1921, height: 1080, line: 3, column: 8, length: 9 }
            });
            expect(() => analyze(code)).toThrow("Width and height must be divisible by 2");
        });
    });

    describe("analyzeEncode", () => {
        it("should not throw if encode is not provided", () => {
            const code = createBaseProgram();
            expect(() => analyze(code)).not.toThrow();
        });

        it("should not throw on valid encode codecs", () => {
            const code = createBaseProgram({
                encode: { type: "ENCODE", videoCodec: VideoCodec.H264, audioCodec: AudioCodec.AAC, line: 4, column: 1, length: 15 }
            });
            expect(() => analyze(code)).not.toThrow();
        });

        it("should throw on invalid video codec", () => {
            const code = createBaseProgram({
                encode: { type: "ENCODE", videoCodec: "invalid_codec" as VideoCodec, audioCodec: AudioCodec.AAC, line: 4, column: 1, length: 20 }
            });
            expect(() => analyze(code)).toThrow("Unsupported video codec: invalid_codec");
        });

        it("should throw on invalid audio codec", () => {
            const code = createBaseProgram({
                encode: { type: "ENCODE", videoCodec: VideoCodec.H264, audioCodec: "invalid_codec" as AudioCodec, line: 4, column: 1, length: 20 }
            });
            expect(() => analyze(code)).toThrow("Unsupported audio codec: invalid_codec");
        });
    });

    describe("analyzeWatermark", () => {
        it("should not throw if watermark is not provided", () => {
            const code = createBaseProgram();
            expect(() => analyze(code)).not.toThrow();
        });

        it("should not throw on valid watermark", () => {
            const code = createBaseProgram({
                watermark: { type: "WATERMARK", file: "logo.png", position: WatermarkPosition.BOTTOM_RIGHT, line: 5, column: 1, length: 29 }
            });
            expect(() => analyze(code)).not.toThrow();
        });

        it("should throw on empty watermark file path", () => {
            const code = createBaseProgram({
                watermark: { type: "WATERMARK", file: "   ", position: WatermarkPosition.BOTTOM_RIGHT, line: 5, column: 1, length: 14 }
            });
            expect(() => analyze(code)).toThrow("Watermark file path cannot be empty.");
        });

        it("should throw on invalid watermark position", () => {
            const code = createBaseProgram({
                watermark: { type: "WATERMARK", file: "logo.png", position: "center" as WatermarkPosition, line: 5, column: 1, length: 24 }
            });
            expect(() => analyze(code)).toThrow("Unsupported watermark position: center");
        });
    });
});
