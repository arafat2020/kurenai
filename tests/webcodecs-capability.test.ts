import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkWebCodecsCapability } from "../src/targets/webcodecs/capability-check.js";
import { type WebCodecsPipelinePlan } from "../src/targets/target.interface.js";

describe("WebCodecs Capability Check", () => {
    const originalVideoEncoder = (globalThis as any).VideoEncoder;
    const originalAudioEncoder = (globalThis as any).AudioEncoder;

    afterEach(() => {
        if (originalVideoEncoder === undefined) {
            delete (globalThis as any).VideoEncoder;
        } else {
            (globalThis as any).VideoEncoder = originalVideoEncoder;
        }

        if (originalAudioEncoder === undefined) {
            delete (globalThis as any).AudioEncoder;
        } else {
            (globalThis as any).AudioEncoder = originalAudioEncoder;
        }
    });

    it("returns supported: false when VideoEncoder is missing in environment", async () => {
        delete (globalThis as any).VideoEncoder;
        delete (globalThis as any).AudioEncoder;

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4",
                    video: { codec: "avc", width: 1280, height: 720 },
                },
            ],
        };

        const res = await checkWebCodecsCapability(plan);
        expect(res.supported).toBe(false);
        if (!res.supported) {
            expect(res.reason).toContain("VideoEncoder is not available");
        }
    });

    it("returns supported: true when encoders support configured codecs", async () => {
        (globalThis as any).VideoEncoder = {
            isConfigSupported: vi.fn().mockResolvedValue({ supported: true }),
        };
        (globalThis as any).AudioEncoder = {
            isConfigSupported: vi.fn().mockResolvedValue({ supported: true }),
        };

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4",
                    video: { codec: "avc", width: 1280, height: 720, frameRate: 30, bitrateBps: 2000000 },
                    audio: { codec: "aac", sampleRate: 48000, channels: 2 },
                },
            ],
        };

        const res = await checkWebCodecsCapability(plan);
        expect(res.supported).toBe(true);

        expect((globalThis as any).VideoEncoder.isConfigSupported).toHaveBeenCalledWith(
            expect.objectContaining({
                codec: "avc1.42001f",
                width: 1280,
                height: 720,
            })
        );
        expect((globalThis as any).AudioEncoder.isConfigSupported).toHaveBeenCalledWith(
            expect.objectContaining({
                codec: "mp4a.40.2",
                sampleRate: 48000,
                numberOfChannels: 2,
            })
        );
    });

    it("returns supported: false with descriptive reason when VideoEncoder rejects codec", async () => {
        (globalThis as any).VideoEncoder = {
            isConfigSupported: vi.fn().mockResolvedValue({ supported: false }),
        };
        (globalThis as any).AudioEncoder = {
            isConfigSupported: vi.fn().mockResolvedValue({ supported: true }),
        };

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4",
                    video: { codec: "hevc", width: 3840, height: 2160 },
                },
            ],
        };

        const res = await checkWebCodecsCapability(plan);
        expect(res.supported).toBe(false);
        if (!res.supported) {
            expect(res.reason).toContain('Video codec "hevc" is not encodable');
        }
    });

    it("returns supported: false when AudioEncoder rejects codec", async () => {
        (globalThis as any).VideoEncoder = {
            isConfigSupported: vi.fn().mockResolvedValue({ supported: true }),
        };
        (globalThis as any).AudioEncoder = {
            isConfigSupported: vi.fn().mockResolvedValue({ supported: false }),
        };

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.webm",
                    container: "webm",
                    audio: { codec: "opus", bitrateBps: 128000 },
                },
            ],
        };

        const res = await checkWebCodecsCapability(plan);
        expect(res.supported).toBe(false);
        if (!res.supported) {
            expect(res.reason).toContain('Audio codec "opus" is not encodable');
        }
    });

    it("handles unknown codec string gracefully", async () => {
        (globalThis as any).VideoEncoder = {
            isConfigSupported: vi.fn(),
        };

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4",
                    video: { codec: "unknown_codec_foo" },
                },
            ],
        };

        const res = await checkWebCodecsCapability(plan);
        expect(res.supported).toBe(false);
        if (!res.supported) {
            expect(res.reason).toContain('Unknown video codec: "unknown_codec_foo"');
        }
    });
});
