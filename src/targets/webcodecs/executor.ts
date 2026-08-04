/**
 * @fileoverview mediabunny-based executor for WebCodecs pipeline plans.
 *
 * This module is intentionally **not imported** by `src/index.ts`.
 * It is only reachable via the `@arafat2020/kurenai/browser` subpath export,
 * ensuring that Node.js bundles never pull in mediabunny as a dependency.
 */

import {
    Input,
    Output,
    Conversion,
    BlobSource,
    BufferTarget,
    Mp4OutputFormat,
    WebMOutputFormat,
    ALL_FORMATS,
} from "mediabunny";
import {
    type WebCodecsPipelinePlan,
    type WebCodecsPipelineOutputConfig,
    type WebCodecsPipelineVideoConfig,
    type WebCodecsPipelineAudioConfig,
} from "../target.interface.js";

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Unified progress event shape, identical regardless of which target ran.
 * The FFmpeg path would parse this from stderr; the WebCodecs path gets it
 * natively from `Conversion.onProgress`.
 */
export interface ExecutionProgress {
    /** Completion ratio from 0 to 1. */
    ratio: number;
    /** Processed media time in seconds. */
    processedSeconds: number;
}

/** Callback signature for progress updates during execution. */
export type ProgressCallback = (progress: ExecutionProgress) => void;

/**
 * The result of a successful `executeWebCodecsPipeline()` call.
 * One entry per output block in the plan.
 */
export interface ExecutionResult {
    /** Filename from the plan. */
    filename: string;
    /** Encoded video bytes. Write to disk or feed to a download link. */
    data: Uint8Array;
}

// ── Output format factory ─────────────────────────────────────────────────────

function createOutputFormat(container: "mp4" | "webm") {
    return container === "webm"
        ? new WebMOutputFormat()
        : new Mp4OutputFormat();
}

// ── Conversion options builder ────────────────────────────────────────────────

function buildConversionVideoOptions(
    video: WebCodecsPipelineVideoConfig,
): Record<string, unknown> {
    const opts: Record<string, unknown> = {};

    if (video.codec)               opts['codec']               = video.codec;
    if (video.width !== undefined)  opts['width']               = video.width;
    if (video.height !== undefined) opts['height']              = video.height;
    if (video.frameRate !== undefined) opts['frameRate']         = video.frameRate;
    if (video.bitrateBps !== undefined) opts['bitrate']          = video.bitrateBps;
    if (video.hardwareAcceleration) opts['hardwareAcceleration'] = video.hardwareAcceleration;

    // When both width and height are set, use "contain" to preserve aspect ratio
    if (video.width !== undefined && video.height !== undefined) {
        opts['fit'] = 'contain';
    }

    return opts;
}

function buildConversionAudioOptions(
    audio: WebCodecsPipelineAudioConfig,
): Record<string, unknown> {
    const opts: Record<string, unknown> = {};

    if (audio.codec)               opts['codec']      = audio.codec;
    if (audio.bitrateBps !== undefined) opts['bitrate']  = audio.bitrateBps;
    if (audio.sampleRate !== undefined) opts['sampleRate'] = audio.sampleRate;
    if (audio.channels !== undefined)   opts['numberOfChannels'] = audio.channels;

    return opts;
}

// ── Single-output executor ────────────────────────────────────────────────────

async function executeSingleOutput(
    file: File | Blob,
    outConfig: WebCodecsPipelineOutputConfig,
    onProgress?: ProgressCallback,
): Promise<ExecutionResult> {
    const input = new Input({
        source: new BlobSource(file),
        formats: ALL_FORMATS,
    });

    const bufferTarget = new BufferTarget();
    const output = new Output({
        format: createOutputFormat(outConfig.container),
        target: bufferTarget,
    });

    const conversionOptions: Record<string, unknown> = {
        input,
        output,
    };

    if (outConfig.video) {
        conversionOptions['video'] = buildConversionVideoOptions(outConfig.video);
    }
    if (outConfig.audio) {
        conversionOptions['audio'] = buildConversionAudioOptions(outConfig.audio);
    }
    if (outConfig.trim) {
        if (outConfig.trim.start !== undefined) conversionOptions['start'] = outConfig.trim.start;
        if (outConfig.trim.end   !== undefined) conversionOptions['end']   = outConfig.trim.end;
    }

    const conversion = await Conversion.init(conversionOptions as Parameters<typeof Conversion.init>[0]);

    if (onProgress) {
        conversion.onProgress = (ratio: number, processedTime: number) => {
            onProgress({ ratio, processedSeconds: processedTime });
        };
    }

    await conversion.execute();

    if (!bufferTarget.buffer) {
        throw new Error(`[kurenai/webcodecs] Conversion produced no output for "${outConfig.filename}".`);
    }

    return {
        filename: outConfig.filename,
        data:     new Uint8Array(bufferTarget.buffer),
    };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Executes a `WebCodecsPipelinePlan` against a source media `File` or `Blob`
 * using the mediabunny library as the WebCodecs-backed engine.
 *
 * **Important**: Call `checkWebCodecsCapability(plan)` before this function
 * to verify codec support in the current browser before starting encoding.
 *
 * **Memory safety**: mediabunny streams the conversion rather than buffering
 * the entire file in memory. However, for very large files, consider routing
 * to the server-side FFmpeg path instead.
 *
 * @param plan    The plan produced by `WebCodecsCodeGenerator.generate()`.
 * @param file    The source media file as a browser `File` or `Blob`.
 * @param onProgress Optional callback for progress updates (0–1 ratio).
 *
 * @returns An array of `ExecutionResult` objects — one per output in the plan —
 *          each containing the encoded bytes and filename.
 *
 * @example
 * ```ts
 * import { compileTarget } from "@arafat2020/kurenai";
 * import {
 *   checkWebCodecsCapability,
 *   executeWebCodecsPipeline
 * } from "@arafat2020/kurenai/browser";
 *
 * const result = compileTarget(source); // auto-detects browser → WebCodecsOutput
 *
 * if (result.target === "webcodecs") {
 *   const capability = await checkWebCodecsCapability(result.plan);
 *   if (!capability.supported) {
 *     console.warn("Falling back to server:", capability.reason);
 *     return submitToServer(source);
 *   }
 *
 *   const [outputFile] = await executeWebCodecsPipeline(
 *     result.plan,
 *     inputFile,             // File | Blob from an <input type="file">
 *     ({ ratio }) => setProgress(ratio),
 *   );
 *
 *   const url = URL.createObjectURL(new Blob([outputFile.data]));
 *   downloadLink.href = url;
 * }
 * ```
 */
export async function executeWebCodecsPipeline(
    plan: WebCodecsPipelinePlan,
    file: File | Blob,
    onProgress?: ProgressCallback,
): Promise<ExecutionResult[]> {
    // Warn about unsupported thumbnail extraction (skipped, not thrown)
    if (plan.thumbnail) {
        console.warn(
            '[kurenai/webcodecs] Thumbnail extraction is not supported by the WebCodecs executor. ' +
            'The thumbnail step will be skipped. Use { target: "ffmpeg" } if thumbnail extraction is required.',
        );
    }

    const results: ExecutionResult[] = [];

    for (let i = 0; i < plan.outputs.length; i++) {
        const outConfig = plan.outputs[i]!;

        // For multiple outputs, normalize the progress callback to a per-output
        // sub-range so the caller sees overall 0→1 progress
        let progressForThisOutput: ProgressCallback | undefined;
        if (onProgress && plan.outputs.length > 1) {
            const segmentSize = 1 / plan.outputs.length;
            const segmentStart = i * segmentSize;
            progressForThisOutput = ({ ratio, processedSeconds }) => {
                onProgress({
                    ratio:            segmentStart + ratio * segmentSize,
                    processedSeconds,
                });
            };
        } else {
            progressForThisOutput = onProgress;
        }

        const result = await executeSingleOutput(file, outConfig, progressForThisOutput);
        results.push(result);
    }

    return results;
}
