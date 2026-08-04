import { type IR } from "../ir/types.js";
import { type CanonicalVideoCodec, type CanonicalAudioCodec } from "../ir/types.js";

// ── Code generator interface ──────────────────────────────────────────────────

/**
 * Contract every Kurenai code generator must satisfy.
 * Each generator takes a normalized `IR` and produces a typed output.
 *
 * @typeParam TOutput The specific output type for this target.
 */
export interface ICodeGenerator<TOutput> {
    generate(ir: IR): TOutput;
}

// ── FFmpeg output ─────────────────────────────────────────────────────────────

/**
 * Output produced by the FFmpeg code generator.
 *
 * The `target` discriminant lets callers narrow the union type before
 * accessing `.commands`:
 *
 * ```ts
 * const result = compileTarget(source);
 * if (result.target === "ffmpeg") {
 *   console.log(result.commands[0]); // safe
 * }
 * ```
 */
export interface FFmpegOutput {
    /** Discriminant: always `"ffmpeg"` for this output type. */
    target: "ffmpeg";
    /**
     * One or more FFmpeg command strings ready for execution.
     * Multiple commands are generated when a script has multiple outputs
     * or a thumbnail extraction step.
     */
    commands: string[];
}

// ── WebCodecs pipeline plan ───────────────────────────────────────────────────

/**
 * Describes the video encoding configuration for the mediabunny executor.
 */
export interface WebCodecsPipelineVideoConfig {
    /**
     * mediabunny/WebCodecs codec string.
     * e.g. "avc" for H.264, "vp09" for VP9, "vp8" for VP8, "av1" for AV1.
     */
    codec: string;
    /** Output width in pixels. Undefined = keep source width. */
    width?: number;
    /** Output height in pixels. Undefined = keep source height. */
    height?: number;
    /** Output frame rate. Undefined = keep source fps. */
    frameRate?: number;
    /** Video bitrate in bits per second. Undefined = use quality preset. */
    bitrateBps?: number;
    /** Hardware acceleration preference. Defaults to "no-preference". */
    hardwareAcceleration?: "no-preference" | "prefer-hardware" | "prefer-software";
}

/**
 * Describes the audio encoding configuration for the mediabunny executor.
 */
export interface WebCodecsPipelineAudioConfig {
    /**
     * mediabunny/WebCodecs codec string.
     * e.g. "opus" for Opus, "aac" for AAC.
     */
    codec: string;
    /** Audio bitrate in bits per second. */
    bitrateBps?: number;
    /** Sample rate in Hz. */
    sampleRate?: number;
    /** Number of output channels (1 = mono, 2 = stereo). */
    channels?: 1 | 2;
}

/**
 * Describes a single output in the pipeline plan.
 */
export interface WebCodecsPipelineOutputConfig {
    /** Output filename. Used to determine the container format. */
    filename: string;
    /** Target container format derived from filename extension. */
    container: "mp4" | "webm";
    /** Video config for this output (merged from top-level + overrides). */
    video?: WebCodecsPipelineVideoConfig;
    /** Audio config for this output (merged from top-level + overrides). */
    audio?: WebCodecsPipelineAudioConfig;
    /** Time range to trim the input to (in seconds). */
    trim?: { start?: number; end?: number };
}

/**
 * A self-contained, serializable plan describing what the mediabunny
 * executor should do. Produced by `WebCodecsCodeGenerator.generate()`.
 *
 * This plan is intentionally pure data — no functions, no DOM references —
 * so it can be inspected, logged, or sent over a Worker message port.
 *
 * Use `executeWebCodecsPipeline(plan, file)` from `@arafat2020/kurenai/browser`
 * to actually run it.
 */
export interface WebCodecsPipelinePlan {
    /**
     * Source canonical video codec (for capability checking before execution).
     */
    sourceVideoCodec?: CanonicalVideoCodec;
    /**
     * Source canonical audio codec (for capability checking before execution).
     */
    sourceAudioCodec?: CanonicalAudioCodec;
    /** Per-output encoding plans. */
    outputs: WebCodecsPipelineOutputConfig[];
    /**
     * Thumbnail extraction timestamp in seconds, if requested.
     * Thumbnail extraction is not supported by the WebCodecs executor;
     * if present, the executor will emit a console warning and skip it.
     */
    thumbnail?: { atSeconds: number };
}

// ── WebCodecs output ──────────────────────────────────────────────────────────

/**
 * Output produced by the WebCodecs code generator.
 *
 * The `target` discriminant lets callers narrow the union type before
 * accessing `.plan`:
 *
 * ```ts
 * const result = compileTarget(source);
 * if (result.target === "webcodecs") {
 *   const bytes = await executeWebCodecsPipeline(result.plan, file);
 * }
 * ```
 */
export interface WebCodecsOutput {
    /** Discriminant: always `"webcodecs"` for this output type. */
    target: "webcodecs";
    /** The mediabunny-ready pipeline plan. */
    plan: WebCodecsPipelinePlan;
}

// ── Discriminated union ───────────────────────────────────────────────────────

/**
 * The return type of `compileTarget()`.
 *
 * Narrow on `result.target` before accessing target-specific fields:
 *
 * ```ts
 * const result = compileTarget(source, { target: "auto" });
 *
 * if (result.target === "ffmpeg") {
 *   runFFmpeg(result.commands[0]);         // string[] ✓
 * } else {
 *   executeWebCodecsPipeline(result.plan, file); // WebCodecsPipelinePlan ✓
 * }
 * ```
 */
export type CompileOutput = FFmpegOutput | WebCodecsOutput;

// Re-export IR for external consumers who import from this file
export type { IR };
