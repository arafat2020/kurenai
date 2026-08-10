import {
    type WebCodecsPipelinePlan,
    type WebCodecsPipelineVideoConfig,
    type WebCodecsPipelineAudioConfig,
} from "../target.interface.js";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CapabilityCheckResult =
    | { supported: true }
    | { supported: false; reason: string };

// ── Codec string mapping for isConfigSupported ────────────────────────────────

/**
 * Maps mediabunny codec strings to the full codec strings needed by
 * `VideoEncoder.isConfigSupported()`.
 *
 * The WebCodecs API requires codec strings in the full codec-string format
 * (e.g. "avc1.42001f") rather than the shorthand used by mediabunny ("avc").
 */
const WEBCODECS_VIDEO_CODEC_STRINGS: Record<string, string> = {
    avc:  'avc1.42001f',  // H.264 Baseline profile level 3.1
    hevc: 'hvc1.1.6.L93.B0', // H.265
    vp8:  'vp8',
    vp09: 'vp09.00.10.08', // VP9 profile 0
    av01: 'av01.0.01M.08', // AV1 Main profile
};

/**
 * Maps mediabunny audio codec strings to the full codec strings needed by
 * `AudioEncoder.isConfigSupported()`.
 */
const WEBCODECS_AUDIO_CODEC_STRINGS: Record<string, string> = {
    opus:    'opus',
    aac:     'mp4a.40.2',  // AAC-LC
    vorbis:  'vorbis',
    flac:    'flac',
    mp3:     'mp3',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

async function checkVideoConfig(
    video: WebCodecsPipelineVideoConfig,
): Promise<CapabilityCheckResult> {
    if (typeof VideoEncoder === 'undefined') {
        return { supported: false, reason: 'VideoEncoder is not available in this environment. WebCodecs requires a modern browser.' };
    }

    const codecString = WEBCODECS_VIDEO_CODEC_STRINGS[video.codec];
    if (!codecString) {
        return { supported: false, reason: `Unknown video codec: "${video.codec}"` };
    }

    try {
        const config: VideoEncoderConfig = {
            codec:     codecString,
            width:     video.width  ?? 1280,
            height:    video.height ?? 720,
        };
        if (video.bitrateBps !== undefined) config.bitrate = video.bitrateBps;
        if (video.frameRate  !== undefined) config.framerate = video.frameRate;
        if (video.hardwareAcceleration) {
            config.hardwareAcceleration = video.hardwareAcceleration;
        }

        const support = await VideoEncoder.isConfigSupported(config);
        if (!support.supported) {
            return {
                supported: false,
                reason: `Video codec "${video.codec}" is not encodable in this browser. ` +
                        `Try switching to a different codec or use { target: "ffmpeg" } to process on the server.`,
            };
        }
    } catch (e) {
        return {
            supported: false,
            reason: `Failed to check video codec support: ${e instanceof Error ? e.message : String(e)}`,
        };
    }

    return { supported: true };
}

async function checkAudioConfig(
    audio: WebCodecsPipelineAudioConfig,
): Promise<CapabilityCheckResult> {
    if (typeof AudioEncoder === 'undefined') {
        return { supported: false, reason: 'AudioEncoder is not available in this environment. WebCodecs requires a modern browser.' };
    }

    const codecString = WEBCODECS_AUDIO_CODEC_STRINGS[audio.codec];
    if (!codecString) {
        return { supported: false, reason: `Unknown audio codec: "${audio.codec}"` };
    }

    try {
        const config: AudioEncoderConfig = {
            codec:            codecString,
            sampleRate:       audio.sampleRate ?? 48_000,
            numberOfChannels: audio.channels   ?? 2,
        };
        if (audio.bitrateBps !== undefined) config.bitrate = audio.bitrateBps;

        const support = await AudioEncoder.isConfigSupported(config);
        if (!support.supported) {
            return {
                supported: false,
                reason: `Audio codec "${audio.codec}" is not encodable in this browser. ` +
                        `Try switching to a different codec or use { target: "ffmpeg" } to process on the server.`,
            };
        }
    } catch (e) {
        return {
            supported: false,
            reason: `Failed to check audio codec support: ${e instanceof Error ? e.message : String(e)}`,
        };
    }

    return { supported: true };
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Checks whether the browser/environment can actually encode the codecs
 * described in a `WebCodecsPipelinePlan` **before** attempting to run it.
 *
 * Call this function before `executeWebCodecsPipeline()` to give users a
 * clear message when their browser doesn't support the requested codec,
 * rather than discovering it as a cryptic runtime error mid-encode.
 *
 * @example
 * ```ts
 * const result = compileTarget(source); // WebCodecsOutput
 * if (result.target === "webcodecs") {
 *   const capability = await checkWebCodecsCapability(result.plan);
 *   if (!capability.supported) {
 *     // Fall back to server-side FFmpeg
 *     submitToServerQueue(source);
 *   } else {
 *     const bytes = await executeWebCodecsPipeline(result.plan, file);
 *   }
 * }
 * ```
 *
 * @param plan The `WebCodecsPipelinePlan` from `WebCodecsCodeGenerator.generate()`.
 * @returns `{ supported: true }` if all codecs are encodable,
 *          `{ supported: false; reason: string }` otherwise.
 */
export async function checkWebCodecsCapability(
    plan: WebCodecsPipelinePlan,
): Promise<CapabilityCheckResult> {
    for (const out of plan.outputs) {
        // Check video
        if (out.video) {
            const videoCheck = await checkVideoConfig(out.video);
            if (!videoCheck.supported) return videoCheck;
        }

        // Check audio
        if (out.audio) {
            const audioCheck = await checkAudioConfig(out.audio);
            if (!audioCheck.supported) return audioCheck;
        }
    }

    return { supported: true };
}
