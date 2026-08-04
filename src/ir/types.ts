/**
 * Canonical video codec identifiers used by the Kurenai IR.
 * Both the FFmpeg and WebCodecs code generators map from this enum
 * to their own target-specific strings.
 */
export type CanonicalVideoCodec = "h264" | "h265" | "vp8" | "vp9" | "av1" | "mpeg2video" | "theora";

/**
 * Canonical audio codec identifiers used by the Kurenai IR.
 */
export type CanonicalAudioCodec = "aac" | "mp3" | "opus" | "vorbis" | "flac" | "pcm_s16le" | "ac3";

/**
 * Validated watermark position values.
 * Every codegen maps these enum values to its own coordinate system.
 */
export type IRWatermarkPosition =
    | "top-left"
    | "top-right"
    | "bottom-left"
    | "bottom-right"
    | "center";

/**
 * Supported output containers, derived from the output filename extension.
 */
export type IRContainer = "mp4" | "webm" | "mkv" | "avi" | "mov" | "flac" | "mp3" | "wav" | "ogg" | "aac" | "opus";

// ── Video configuration ──────────────────────────────────────────────────────

export interface IRVideoConfig {
    /** Width in pixels. Undefined means "keep source width". */
    width?: number;
    /** Height in pixels. Undefined means "keep source height". */
    height?: number;
    /** Frames per second. Undefined means "keep source fps". */
    frameRate?: number;
    /** Canonical codec enum. Undefined means "copy codec". */
    codec?: CanonicalVideoCodec;
    /** Video bitrate in bits per second (already parsed from "2M" / "3000k"). */
    bitrateBps?: number;
}

// ── Audio configuration ──────────────────────────────────────────────────────

export interface IRAudioConfig {
    /** External audio file to mix in, if any. */
    externalFile?: string;
    /** Canonical audio codec enum. */
    codec?: CanonicalAudioCodec;
    /** Audio bitrate in bits per second (already parsed). */
    bitrateBps?: number;
    /** Sample rate in Hz. */
    sampleRate?: number;
    /** Number of audio channels (1 = mono, 2 = stereo). */
    channels?: 1 | 2;
    /** Normalization target level in LUFS. */
    normalizeLufs?: number;
    /** Normalization target true peak in dBTP. */
    normalizeDbtp?: number;
    /** EQ settings. */
    eq?: { bass?: number; mid?: number; treble?: number };
    /** Compressor settings. */
    compress?: { threshold?: number; ratio?: number; attack?: number; release?: number };
    /** Reverb type. */
    reverb?: "subtle" | "medium" | "large";
    /** Fade-in duration in seconds. */
    fadeInSeconds?: number;
    /** Fade-out duration in seconds. */
    fadeOutSeconds?: number;
}

// ── Per-output overrides ──────────────────────────────────────────────────────

export interface IROutputOverrides {
    video?: Partial<IRVideoConfig>;
    audio?: Partial<IRAudioConfig>;
    watermark?: { imagePath: string; position: IRWatermarkPosition };
    thumbnail?: { atSeconds: number };
}

// ── Output block ─────────────────────────────────────────────────────────────

export interface IROutput {
    /** Resolved output filename. */
    filename: string;
    /** Derived output container type. */
    container: IRContainer;
    /** Per-output overrides that take precedence over top-level config. */
    overrides?: IROutputOverrides;
}

// ── Watermark ─────────────────────────────────────────────────────────────────

export interface IRWatermark {
    imagePath: string;
    position: IRWatermarkPosition;
}

// ── Thumbnail ─────────────────────────────────────────────────────────────────

export interface IRThumbnail {
    /** Timestamp in seconds at which to extract the thumbnail frame. */
    atSeconds: number;
}

// ── Root IR ──────────────────────────────────────────────────────────────────

/**
 * The Kurenai Intermediate Representation (IR).
 *
 * This is the output of the semantic analyzer and the **single source of truth**
 * consumed by all code generators. Values here are fully normalized:
 *
 * - Bitrates are `number` (bps), not strings like `"2M"`.
 * - Codecs are canonical enum values, not raw parser strings.
 * - Watermark positions are validated enum values.
 * - Dimensions are `number`, not raw resolution strings.
 *
 * Both `FFmpegCodeGenerator` and `WebCodecsCodeGenerator` accept an `IR` and
 * map its values to their own target vocabularies.
 */
export interface IR {
    /** Source input file path. */
    input: string;
    /** One or more output blocks (a script may have multiple outputs). */
    outputs: IROutput[];
    /** Top-level video encoding config (may be overridden per-output). */
    video: IRVideoConfig;
    /** Top-level audio config (may be overridden per-output). */
    audio?: IRAudioConfig;
    /** Optional watermark config (may be overridden per-output). */
    watermark?: IRWatermark;
    /** Optional thumbnail extraction config. */
    thumbnail?: IRThumbnail;
    /**
     * Whether the input is an audio-only file (e.g. .mp3, .wav).
     * Used by codegens to skip video-filter steps.
     */
    isAudioOnly: boolean;
    /**
     * Whether this was parsed as a V2 script (multi-source / timeline / mix).
     * V2 scripts are only supported by the FFmpeg target.
     */
    isV2: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parses a Kurenai bitrate string ("3000k", "2M", "500g") into bits per second.
 * Returns `undefined` if the input is nullish or unrecognizable.
 */
export function parseBitrateToBps(raw: string | undefined): number | undefined {
    if (!raw) return undefined;

    const lower = raw.toLowerCase();
    const match = lower.match(/^(\d+(?:\.\d+)?)([kmg]?)$/);
    if (!match) return undefined;

    const value = parseFloat(match[1]!);
    const suffix = match[2];

    switch (suffix) {
        case 'k': return Math.round(value * 1_000);
        case 'm': return Math.round(value * 1_000_000);
        case 'g': return Math.round(value * 1_000_000_000);
        default:  return Math.round(value);
    }
}

/**
 * Parses a Kurenai time string ("10s", "30s") into seconds as a number.
 * Returns `undefined` if the input is nullish.
 */
export function parseTimeToSeconds(raw: string | undefined): number | undefined {
    if (!raw) return undefined;
    const numeric = parseFloat(raw.replace(/[a-z]+$/i, ''));
    return isNaN(numeric) ? undefined : numeric;
}

/**
 * Derives the container type from a filename by its extension.
 */
export function containerFromFilename(filename: string): IRContainer {
    const ext = filename.includes('.')
        ? filename.slice(filename.lastIndexOf('.')).toLowerCase()
        : '';

    const containerMap: Record<string, IRContainer> = {
        '.mp4': 'mp4', '.m4v': 'mp4',
        '.webm': 'webm',
        '.mkv': 'mkv',
        '.avi': 'avi',
        '.mov': 'mov',
        '.flac': 'flac',
        '.mp3': 'mp3',
        '.wav': 'wav',
        '.ogg': 'ogg',
        '.aac': 'aac',
        '.opus': 'opus',
    };

    return containerMap[ext] ?? 'mp4';
}
