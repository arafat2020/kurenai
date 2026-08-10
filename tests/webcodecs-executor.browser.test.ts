/**
 * @file webcodecs-executor.browser.test.ts
 *
 * Tests `executeWebCodecsPipeline()` in a real Chromium browser via Vitest
 * Browser Mode. Exercises the full mediabunny encode path end-to-end.
 *
 * ## Media fixture
 * A valid 64×64 @ 10fps, 1-second AVC+Opus MP4 is generated *in-browser*
 * inside beforeAll() using WebCodecs APIs + mp4-muxer:
 *   - VideoFrame from raw RGBA Uint8ClampedArray (solid black, no canvas)
 *   - AudioData from Float32Array zeros (silence) in 960-sample Opus frames
 *   - VideoEncoder (avc1.42001f, prefer-software)
 *   - AudioEncoder (opus — open-source, always available in headless Chromium)
 *   - mp4-muxer ArrayBufferTarget for ISO Base Media File muxing
 *
 * NOTE: AAC encoding (mp4a.40.2) is *not* available in headless Chromium
 * because it is a proprietary codec disabled in open-source Chromium builds.
 * Opus is used instead — it is fully open-source and always present in Chrome.
 *
 * Zero network access. Zero pre-committed binary files.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { executeWebCodecsPipeline } from "../src/targets/webcodecs/executor.js";
import { checkWebCodecsCapability } from "../src/targets/webcodecs/capability-check.js";
import { type WebCodecsPipelinePlan } from "../src/targets/target.interface.js";

// ── Fixture constants ─────────────────────────────────────────────────────────

const W           = 64;        // frame width (px)
const H           = 64;        // frame height (px)
const FPS         = 10;        // frames per second
const FRAMES      = 10;        // 1 s of video at 10 fps
const SR          = 48_000;    // sample rate — Chrome requires 44100 or 48000
const OPUS_FRAME  = 960;       // standard Opus frame size (20 ms @ 48kHz)

// ── In-browser MP4 generator ──────────────────────────────────────────────────

/**
 * Generates a minimal valid AVC+Opus MP4 blob entirely inside the browser
 * using the WebCodecs API and mp4-muxer.
 *
 * - Video: 10 solid-black 64×64 RGBA frames → H.264 Baseline
 * - Audio: 1 second of silence in 20-ms Opus frames
 * - Output: an ArrayBuffer muxed as ISO Base Media File (MP4 container)
 *
 * Opus is used (not AAC) because AAC encoding is disabled in headless
 * Chromium (proprietary codec). Opus is open-source and always available.
 */
async function generateMp4Fixture(): Promise<Blob> {
    const target = new ArrayBufferTarget();
    const muxer  = new Muxer({
        target,
        video: { codec: "avc", width: W, height: H, frameRate: FPS },
        audio: { codec: "opus", numberOfChannels: 1, sampleRate: SR },
        fastStart: "in-memory",
    });

    // ── Video: raw RGBA → VideoFrame (no OffscreenCanvas needed) ─────────────
    await new Promise<void>((resolve, reject) => {
        const enc = new VideoEncoder({
            output: (chunk, meta) => muxer.addVideoChunk(chunk, meta!),
            error: reject,
        });
        enc.configure({
            codec: "avc1.42001f",
            width: W,
            height: H,
            bitrate: 100_000,
            framerate: FPS,
            hardwareAcceleration: "prefer-software",
        });

        // Opaque black RGBA frame: alpha = 255, RGB = 0
        const rgba = new Uint8ClampedArray(W * H * 4);
        for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;

        for (let i = 0; i < FRAMES; i++) {
            const frame = new VideoFrame(rgba, {
                format:      "RGBA",
                codedWidth:  W,
                codedHeight: H,
                timestamp:   Math.round((i * 1_000_000) / FPS),
            });
            enc.encode(frame, { keyFrame: i === 0 });
            frame.close();
        }
        enc.flush().then(() => { enc.close(); resolve(); }).catch(reject);
    });

    // ── Audio: silence in 960-sample Opus frames ──────────────────────────────
    await new Promise<void>((resolve, reject) => {
        const enc = new AudioEncoder({
            output: (chunk, meta) => muxer.addAudioChunk(chunk, meta!),
            error: reject,
        });
        enc.configure({
            codec:            "opus",
            sampleRate:       SR,
            numberOfChannels: 1,
            bitrate:          32_000,
        });

        // Feed 1 second of silence as 20-ms Opus frames
        for (let i = 0; i < SR; i += OPUS_FRAME) {
            const frames = Math.min(OPUS_FRAME, SR - i);
            const audio  = new AudioData({
                format:           "f32-planar",
                sampleRate:       SR,
                numberOfFrames:   frames,
                numberOfChannels: 1,
                timestamp:        Math.round((i * 1_000_000) / SR),
                data:             new Float32Array(frames),
            });
            enc.encode(audio);
            audio.close();
        }
        enc.flush().then(() => { enc.close(); resolve(); }).catch(reject);
    });

    muxer.finalize();
    return new Blob([target.buffer!], { type: "video/mp4" });
}

// ── Shared fixture ────────────────────────────────────────────────────────────

let mp4Fixture: Blob | null = null;
let fixtureError: string | null = null;

beforeAll(async () => {
    try {
        mp4Fixture = await generateMp4Fixture();
        const kb = (mp4Fixture.size / 1024).toFixed(1);
        console.info(`[executor test] Generated ${kb} KB AVC+Opus MP4 fixture in-browser.`);
    } catch (e) {
        fixtureError = e instanceof Error ? e.message : String(e);
        console.error(`[executor test] Fixture generation failed: ${fixtureError}`);
    }
}, 30_000);

function getFixture(): Blob {
    if (!mp4Fixture) throw new Error(`MP4 fixture unavailable: ${fixtureError}`);
    return mp4Fixture;
}

async function isUnsupported(plan: WebCodecsPipelinePlan): Promise<boolean> {
    if (!mp4Fixture) return true;
    const cap = await checkWebCodecsCapability(plan);
    return !cap.supported;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("WebCodecs Executor (browser environment — real encode)", () => {

    // ── API surface ──────────────────────────────────────────────────────────

    it("executeWebCodecsPipeline is exported as a function", () => {
        expect(typeof executeWebCodecsPipeline).toBe("function");
    });

    it("checkWebCodecsCapability is exported as a function", () => {
        expect(typeof checkWebCodecsCapability).toBe("function");
    });

    // ── Native WebCodecs availability ────────────────────────────────────────

    it("VideoEncoder is natively available in headless Chromium", () => {
        expect(typeof VideoEncoder).toBe("function");
    });

    it("AudioEncoder is natively available in headless Chromium", () => {
        expect(typeof AudioEncoder).toBe("function");
    });

    it("VideoEncoder supports avc1.42001f (H.264 Baseline)", async () => {
        const res = await VideoEncoder.isConfigSupported({
            codec: "avc1.42001f", width: W, height: H,
        });
        expect(res.supported).toBe(true);
    });

    it("AudioEncoder supports opus in headless Chromium", async () => {
        const res = await AudioEncoder.isConfigSupported({
            codec: "opus", sampleRate: SR, numberOfChannels: 1,
        });
        expect(res.supported).toBe(true);
    });

    // ── In-browser fixture ───────────────────────────────────────────────────

    it("in-browser fixture is a non-empty MP4 Blob generated via WebCodecs+mp4-muxer", () => {
        const blob = getFixture();
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe("video/mp4");
        expect(blob.size).toBeGreaterThan(0);
    });

    // ── Capability check ─────────────────────────────────────────────────────

    it("checkWebCodecsCapability returns supported:true for avc+opus", async () => {
        const plan: WebCodecsPipelinePlan = {
            outputs: [{
                filename: "cap.mp4", container: "mp4",
                video: { codec: "avc", width: W, height: H, frameRate: FPS },
                audio: { codec: "opus", sampleRate: SR, channels: 1 },
            }],
        };
        const result = await checkWebCodecsCapability(plan);
        expect(result.supported).toBe(true);
    });

    // ── Real encode round-trips ──────────────────────────────────────────────

    it("encodes avc+opus to MP4 — result is non-empty Uint8Array", async () => {
        const plan: WebCodecsPipelinePlan = {
            outputs: [{
                filename: "out.mp4", container: "mp4",
                video: { codec: "avc", width: W, height: H, frameRate: FPS, bitrateBps: 200_000 },
                audio: { codec: "opus", sampleRate: SR, channels: 1 },
            }],
        };
        if (await isUnsupported(plan)) { console.warn("Skipping: codec unsupported"); return; }

        const results = await executeWebCodecsPipeline(plan, getFixture());
        expect(results).toHaveLength(1);
        expect(results[0]!.filename).toBe("out.mp4");
        expect(results[0]!.data).toBeInstanceOf(Uint8Array);
        expect(results[0]!.data.byteLength).toBeGreaterThan(0);
    }, 30_000);

    it("encodes vp9+opus to WebM — result is non-empty Uint8Array", async () => {
        // mediabunny uses 'vp9' (not 'vp09') as its video codec option string
        const plan: WebCodecsPipelinePlan = {
            outputs: [{
                filename: "out.webm", container: "webm",
                video: { codec: "vp9", width: W, height: H, frameRate: FPS, bitrateBps: 200_000 },
                audio: { codec: "opus", sampleRate: SR, channels: 1 },
            }],
        };
        if (await isUnsupported(plan)) { console.warn("Skipping: codec unsupported"); return; }

        const results = await executeWebCodecsPipeline(plan, getFixture());
        expect(results).toHaveLength(1);
        expect(results[0]!.filename).toBe("out.webm");
        expect(results[0]!.data).toBeInstanceOf(Uint8Array);
        expect(results[0]!.data.byteLength).toBeGreaterThan(0);
    }, 30_000);

    it("progress callback receives ratio values in [0,1] during encode", async () => {
        const plan: WebCodecsPipelinePlan = {
            outputs: [{
                filename: "prog.mp4", container: "mp4",
                video: { codec: "avc", width: W, height: H, frameRate: FPS, bitrateBps: 200_000 },
                audio: { codec: "opus", sampleRate: SR, channels: 1 },
            }],
        };
        if (await isUnsupported(plan)) { console.warn("Skipping: codec unsupported"); return; }

        const ratios: number[] = [];
        await executeWebCodecsPipeline(plan, getFixture(), ({ ratio }) => ratios.push(ratio));

        for (const r of ratios) {
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(1);
        }
    }, 30_000);

    it("thumbnail console.warn is emitted and output is still produced", async () => {
        const plan: WebCodecsPipelinePlan = {
            outputs: [{
                filename: "thumb.mp4", container: "mp4",
                video: { codec: "avc", width: W, height: H, frameRate: FPS, bitrateBps: 200_000 },
                audio: { codec: "opus", sampleRate: SR, channels: 1 },
            }],
            thumbnail: { atSeconds: 0.5 },
        };
        if (await isUnsupported(plan)) { console.warn("Skipping: codec unsupported"); return; }

        // Set up spy BEFORE executing so it captures the warn inside executeWebCodecsPipeline
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
        const results = await executeWebCodecsPipeline(plan, getFixture());

        // Assert BEFORE restore so the spy's call history is still intact
        expect(warnSpy).toHaveBeenCalledWith(
            expect.stringContaining("Thumbnail extraction is not supported")
        );
        expect(results[0]!.data.byteLength).toBeGreaterThan(0);
        warnSpy.mockRestore();
    }, 30_000);

    it("2-output plan produces 2 results with correct filenames and non-empty data", async () => {
        const plan: WebCodecsPipelinePlan = {
            outputs: [
                {
                    filename: "low.mp4", container: "mp4",
                    video: { codec: "avc", width: W, height: H, frameRate: FPS, bitrateBps: 100_000 },
                    audio: { codec: "opus", sampleRate: SR, channels: 1 },
                },
                {
                    filename: "high.mp4", container: "mp4",
                    video: { codec: "avc", width: W, height: H, frameRate: FPS, bitrateBps: 300_000 },
                    audio: { codec: "opus", sampleRate: SR, channels: 1 },
                },
            ],
        };
        if (await isUnsupported(plan)) { console.warn("Skipping: codec unsupported"); return; }

        const progressRatios: number[] = [];
        const results = await executeWebCodecsPipeline(
            plan, getFixture(), ({ ratio }) => progressRatios.push(ratio)
        );

        expect(results).toHaveLength(2);
        expect(results[0]!.filename).toBe("low.mp4");
        expect(results[1]!.filename).toBe("high.mp4");
        for (const r of results) {
            expect(r.data).toBeInstanceOf(Uint8Array);
            expect(r.data.byteLength).toBeGreaterThan(0);
        }
        for (const r of progressRatios) {
            expect(r).toBeGreaterThanOrEqual(0);
            expect(r).toBeLessThanOrEqual(1);
        }
    }, 60_000);
});
