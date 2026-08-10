/**
 * @file webcodecs-capability.browser.test.ts
 *
 * Tests `checkWebCodecsCapability()` in a **real Chromium browser** via
 * Vitest Browser Mode. VideoEncoder / AudioEncoder globals are natively
 * available here — no globalThis monkey-patching needed.
 *
 * We mock `isConfigSupported` on the native class so the tests are
 * deterministic regardless of which codecs the test machine's GPU exposes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkWebCodecsCapability } from "../src/targets/webcodecs/capability-check.js";
import { type WebCodecsPipelinePlan } from "../src/targets/target.interface.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Spy on VideoEncoder.isConfigSupported to return a fixed answer. */
function mockVideoSupport(supported: boolean) {
    return vi
        .spyOn(VideoEncoder, "isConfigSupported")
        .mockResolvedValue({ supported, config: {} } as VideoEncoderSupport);
}

/** Spy on AudioEncoder.isConfigSupported to return a fixed answer. */
function mockAudioSupport(supported: boolean) {
    return vi
        .spyOn(AudioEncoder, "isConfigSupported")
        .mockResolvedValue({ supported, config: {} } as AudioEncoderSupport);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WebCodecs Capability Check (browser environment)", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ── Positive cases ──────────────────────────────────────────────────────

    it("native VideoEncoder class is available in the browser", () => {
        expect(typeof VideoEncoder).toBe("function");
    });

    it("native AudioEncoder class is available in the browser", () => {
        expect(typeof AudioEncoder).toBe("function");
    });

    it("returns supported:true for h264+aac when browser claims support", async () => {
        mockVideoSupport(true);
        mockAudioSupport(true);

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4",
                    video: { codec: "avc", width: 1280, height: 720, frameRate: 30, bitrateBps: 2_000_000 },
                    audio: { codec: "aac", sampleRate: 48_000, channels: 2 },
                },
            ],
        };

        const result = await checkWebCodecsCapability(plan);
        expect(result.supported).toBe(true);
    });

    it("passes the correct full codec string for avc to VideoEncoder.isConfigSupported", async () => {
        const spy = mockVideoSupport(true);
        mockAudioSupport(true);

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4",
                    video: { codec: "avc", width: 1920, height: 1080 },
                    audio: { codec: "aac" },
                },
            ],
        };

        await checkWebCodecsCapability(plan);

        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ codec: "avc1.42001f", width: 1920, height: 1080 })
        );
    });

    it("passes the correct full codec string for aac to AudioEncoder.isConfigSupported", async () => {
        mockVideoSupport(true);
        const spy = mockAudioSupport(true);

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4",
                    video: { codec: "avc", width: 1280, height: 720 },
                    audio: { codec: "aac", sampleRate: 44_100, channels: 2 },
                },
            ],
        };

        await checkWebCodecsCapability(plan);

        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ codec: "mp4a.40.2", sampleRate: 44_100, numberOfChannels: 2 })
        );
    });

    it("passes the correct full codec string for opus to AudioEncoder.isConfigSupported", async () => {
        const spy = mockAudioSupport(true);

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.webm",
                    container: "webm",
                    audio: { codec: "opus", bitrateBps: 128_000 },
                },
            ],
        };

        await checkWebCodecsCapability(plan);

        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ codec: "opus" })
        );
    });

    it("passes the correct full codec string for vp09 to VideoEncoder.isConfigSupported", async () => {
        const spy = mockVideoSupport(true);
        mockAudioSupport(true);

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.webm",
                    container: "webm",
                    video: { codec: "vp09", width: 1280, height: 720 },
                    audio: { codec: "opus" },
                },
            ],
        };

        await checkWebCodecsCapability(plan);

        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ codec: "vp09.00.10.08" })
        );
    });

    it("passes the correct full codec string for av01 to VideoEncoder.isConfigSupported", async () => {
        const spy = mockVideoSupport(true);

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4",
                    video: { codec: "av01", width: 1280, height: 720 },
                },
            ],
        };

        await checkWebCodecsCapability(plan);

        expect(spy).toHaveBeenCalledWith(
            expect.objectContaining({ codec: "av01.0.01M.08" })
        );
    });

    // ── Negative cases ──────────────────────────────────────────────────────

    it("returns supported:false when VideoEncoder rejects the codec", async () => {
        mockVideoSupport(false);
        mockAudioSupport(true);

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4",
                    video: { codec: "hevc", width: 3840, height: 2160 },
                },
            ],
        };

        const result = await checkWebCodecsCapability(plan);
        expect(result.supported).toBe(false);
        if (!result.supported) {
            expect(result.reason).toContain('Video codec "hevc" is not encodable');
        }
    });

    it("returns supported:false when AudioEncoder rejects the codec", async () => {
        mockVideoSupport(true);
        mockAudioSupport(false);

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.webm",
                    container: "webm",
                    video: { codec: "vp09", width: 640, height: 480 },
                    audio: { codec: "opus" },
                },
            ],
        };

        const result = await checkWebCodecsCapability(plan);
        expect(result.supported).toBe(false);
        if (!result.supported) {
            expect(result.reason).toContain('Audio codec "opus" is not encodable');
        }
    });

    it("returns supported:false for an unknown video codec string", async () => {
        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4",
                    video: { codec: "totally_unknown_codec_xyz" },
                },
            ],
        };

        const result = await checkWebCodecsCapability(plan);
        expect(result.supported).toBe(false);
        if (!result.supported) {
            expect(result.reason).toContain('Unknown video codec: "totally_unknown_codec_xyz"');
        }
    });

    it("returns supported:false for an unknown audio codec string", async () => {
        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4",
                    audio: { codec: "mystery_audio_codec" },
                },
            ],
        };

        // VideoEncoder not called since there's no video
        const result = await checkWebCodecsCapability(plan);
        expect(result.supported).toBe(false);
        if (!result.supported) {
            expect(result.reason).toContain('Unknown audio codec: "mystery_audio_codec"');
        }
    });

    // ── Audio-only / video-only plans ───────────────────────────────────────

    it("skips VideoEncoder check for audio-only plan", async () => {
        const videoSpy = vi.spyOn(VideoEncoder, "isConfigSupported");
        const audioSpy = mockAudioSupport(true);

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.webm",
                    container: "webm",
                    audio: { codec: "opus" },
                },
            ],
        };

        const result = await checkWebCodecsCapability(plan);
        expect(result.supported).toBe(true);
        expect(videoSpy).not.toHaveBeenCalled();
        expect(audioSpy).toHaveBeenCalledOnce();
    });

    it("skips AudioEncoder check for video-only plan", async () => {
        const videoSpy = mockVideoSupport(true);
        const audioSpy = vi.spyOn(AudioEncoder, "isConfigSupported");

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "out.mp4",
                    container: "mp4",
                    video: { codec: "avc", width: 640, height: 480 },
                },
            ],
        };

        const result = await checkWebCodecsCapability(plan);
        expect(result.supported).toBe(true);
        expect(videoSpy).toHaveBeenCalledOnce();
        expect(audioSpy).not.toHaveBeenCalled();
    });

    // ── Multi-output plan ───────────────────────────────────────────────────

    it("returns supported:false as soon as the first output fails, without checking the rest", async () => {
        const videoSpy = mockVideoSupport(false); // fail on first call
        const audioSpy = vi.spyOn(AudioEncoder, "isConfigSupported");

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "low.mp4",
                    container: "mp4",
                    video: { codec: "avc", width: 640, height: 360 },
                },
                {
                    filename: "high.mp4",
                    container: "mp4",
                    video: { codec: "avc", width: 1920, height: 1080 },
                    audio: { codec: "aac" },
                },
            ],
        };

        const result = await checkWebCodecsCapability(plan);
        expect(result.supported).toBe(false);
        // VideoEncoder called once (first output fails immediately)
        expect(videoSpy).toHaveBeenCalledTimes(1);
        // AudioEncoder never reached
        expect(audioSpy).not.toHaveBeenCalled();
    });

    it("checks all outputs and returns supported:true when every output is supported", async () => {
        const videoSpy = mockVideoSupport(true);
        const audioSpy = mockAudioSupport(true);

        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "low.mp4",
                    container: "mp4",
                    video: { codec: "avc", width: 640, height: 360 },
                    audio: { codec: "aac" },
                },
                {
                    filename: "high.webm",
                    container: "webm",
                    video: { codec: "vp09", width: 1920, height: 1080 },
                    audio: { codec: "opus" },
                },
            ],
        };

        const result = await checkWebCodecsCapability(plan);
        expect(result.supported).toBe(true);
        expect(videoSpy).toHaveBeenCalledTimes(2);
        expect(audioSpy).toHaveBeenCalledTimes(2);
    });
});
