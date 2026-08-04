import { describe, it, expect } from "vitest";
import { lexer } from "../src/lexer.js";
import { parseTokens } from "../src/parser.js";
import { buildIR } from "../src/ir/analyzer.js";
import { parseBitrateToBps, parseTimeToSeconds, containerFromFilename } from "../src/ir/types.js";

describe("IR Builder & Normalization", () => {
    describe("Helpers", () => {
        it("parseBitrateToBps() parses bitrate strings correctly", () => {
            expect(parseBitrateToBps("500k")).toBe(500_000);
            expect(parseBitrateToBps("2M")).toBe(2_000_000);
            expect(parseBitrateToBps("1G")).toBe(1_000_000_000);
            expect(parseBitrateToBps("1500000")).toBe(1_500_000);
            expect(parseBitrateToBps(undefined)).toBeUndefined();
        });

        it("parseTimeToSeconds() parses time strings correctly", () => {
            expect(parseTimeToSeconds("10s")).toBe(10);
            expect(parseTimeToSeconds("5.5s")).toBe(5.5);
            expect(parseTimeToSeconds(undefined)).toBeUndefined();
        });

        it("containerFromFilename() detects containers", () => {
            expect(containerFromFilename("out.mp4")).toBe("mp4");
            expect(containerFromFilename("out.webm")).toBe("webm");
            expect(containerFromFilename("out.mkv")).toBe("mkv");
        });
    });

    describe("buildIR()", () => {
        it("normalizes V1 script into typed IR", () => {
            const source = `
                input "video.mp4"
                resize 1280x720
                fps 30
                encode h264 aac
                bitrate 2M
                watermark "logo.png" top-right
                thumbnail 5s
                output "output.mp4"
            `;
            const tokens = lexer(source);
            const ast = parseTokens(tokens);
            const ir = buildIR(ast);

            expect(ir.input).toBe("video.mp4");
            expect(ir.video.width).toBe(1280);
            expect(ir.video.height).toBe(720);
            expect(ir.video.frameRate).toBe(30);
            expect(ir.video.codec).toBe("h264");
            expect(ir.video.bitrateBps).toBe(2_000_000);
            expect(ir.watermark).toEqual({ imagePath: "logo.png", position: "top-right" });
            expect(ir.thumbnail).toEqual({ atSeconds: 5 });
            expect(ir.outputs).toHaveLength(1);
            expect(ir.outputs[0]?.filename).toBe("output.mp4");
            expect(ir.outputs[0]?.container).toBe("mp4");
            expect(ir.isAudioOnly).toBe(false);
            expect(ir.isV2).toBe(false);
        });

        it("detects audio-only input files", () => {
            const source = `
                input "music.mp3"
                output "output.mp3"
            `;
            const ast = parseTokens(lexer(source));
            const ir = buildIR(ast);

            expect(ir.isAudioOnly).toBe(true);
        });
    });
});
