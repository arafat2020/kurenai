import { type Program } from "../interfaces/parser.js";
import { type ProgramV2 } from "../interfaces/v2.js";
import { analyze } from "../analyzer.js";
import {
    type IR,
    type IROutput,
    type IROutputOverrides,
    type IRVideoConfig,
    type IRAudioConfig,
    type IRWatermark,
    type IRWatermarkPosition,
    type CanonicalVideoCodec,
    type CanonicalAudioCodec,
    parseBitrateToBps,
    parseTimeToSeconds,
    containerFromFilename,
} from "./types.js";
import { type WatermarkPosition } from "../enums/parser.js";

// ── Audio-only file extensions (no video track) ──────────────────────────────
const AUDIO_ONLY_EXTENSIONS = new Set([
    '.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.opus', '.wma', '.aiff',
]);

function isAudioOnlyFile(filename: string): boolean {
    const ext = filename.includes('.')
        ? filename.slice(filename.lastIndexOf('.')).toLowerCase()
        : '';
    return AUDIO_ONLY_EXTENSIONS.has(ext);
}

// ── Codec mappings ──────────────────────────────────────────────────────────

const VIDEO_CODEC_MAP: Record<string, CanonicalVideoCodec> = {
    h264:        'h264',
    h265:        'h265',
    vp8:         'vp8',
    vp9:         'vp9',
    av1:         'av1',
    mpeg2video:  'mpeg2video',
    theora:      'theora',
};

const AUDIO_CODEC_MAP: Record<string, CanonicalAudioCodec> = {
    aac:       'aac',
    mp3:       'mp3',
    opus:      'opus',
    vorbis:    'vorbis',
    flac:      'flac',
    pcm_s16le: 'pcm_s16le',
    ac3:       'ac3',
};

// ── Watermark position normalization ─────────────────────────────────────────

function normalizeWatermarkPosition(raw: WatermarkPosition | string): IRWatermarkPosition {
    const valid = new Set<IRWatermarkPosition>([
        'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center',
    ]);
    const cast = raw as IRWatermarkPosition;
    if (valid.has(cast)) return cast;
    return 'top-left';
}

// ── V1 output overrides normalization ─────────────────────────────────────────

function buildOutputOverrides(
    out: Program['outputs'][number],
): IROutputOverrides | undefined {
    const ov = out.overrides;
    if (!ov || Object.keys(ov).length === 0) return undefined;

    const result: IROutputOverrides = {};

    if (ov.resize || ov.fps || ov.encode || ov.bitrate) {
        const video: IRVideoConfig = {};
        if (ov.resize) {
            video.width  = ov.resize.width;
            video.height = ov.resize.height;
        }
        if (ov.fps) {
            video.frameRate = ov.fps.value;
        }
        if (ov.encode) {
            const mapped = VIDEO_CODEC_MAP[ov.encode.videoCodec];
            if (mapped) video.codec = mapped;
        }
        if (ov.bitrate) {
            const bps = parseBitrateToBps(ov.bitrate.value);
            if (bps !== undefined) video.bitrateBps = bps;
        }
        result.video = video;
    }

    if (ov.audio || ov.encode) {
        const audioConfig: IRAudioConfig = {};
        if (ov.audio) {
            const a = ov.audio;
            if (a.value) audioConfig.externalFile = a.value;
            if (a.codec) {
                const mapped = AUDIO_CODEC_MAP[a.codec];
                if (mapped) audioConfig.codec = mapped;
            }
            if (a.bitrate) {
                const bps = parseBitrateToBps(a.bitrate);
                if (bps !== undefined) audioConfig.bitrateBps = bps;
            }
            if (a.samplerate) audioConfig.sampleRate = a.samplerate;
            if (a.channels)   audioConfig.channels = a.channels === 'stereo' ? 2 : 1;
            if (a.normalize) {
                const unit = a.normalize.unit.toLowerCase();
                if (unit === 'lufs') audioConfig.normalizeLufs = a.normalize.value;
                else if (unit === 'dbtp') audioConfig.normalizeDbtp = a.normalize.value;
            }
            if (a.eq) {
                const eq: { bass?: number; mid?: number; treble?: number } = {};
                if (a.eq.bass !== undefined) eq.bass = a.eq.bass;
                if (a.eq.mid !== undefined) eq.mid = a.eq.mid;
                if (a.eq.treble !== undefined) eq.treble = a.eq.treble;
                audioConfig.eq = eq;
            }
            if (a.compress) audioConfig.compress = { ...a.compress };
            if (a.reverb)   audioConfig.reverb = a.reverb;
            if (a.fadein) {
                const sec = parseTimeToSeconds(a.fadein);
                if (sec !== undefined) audioConfig.fadeInSeconds = sec;
            }
            if (a.fadeout) {
                const sec = parseTimeToSeconds(a.fadeout);
                if (sec !== undefined) audioConfig.fadeOutSeconds = sec;
            }
        }

        if (!audioConfig.codec && ov.encode) {
            const mapped = AUDIO_CODEC_MAP[ov.encode.audioCodec];
            if (mapped) audioConfig.codec = mapped;
        }

        if (Object.keys(audioConfig).length > 0) {
            result.audio = audioConfig;
        }
    }

    if (ov.watermark) {
        result.watermark = {
            imagePath: ov.watermark.file,
            position:  normalizeWatermarkPosition(ov.watermark.position),
        };
    }

    if (ov.thumbnail) {
        result.thumbnail = {
            atSeconds: parseTimeToSeconds(ov.thumbnail.value) ?? 0,
        };
    }

    return Object.keys(result).length > 0 ? result : undefined;
}

// ── V1 Program → IR ──────────────────────────────────────────────────────────

function buildIRFromV1(program: Program): IR {
    const video: IRVideoConfig = {};
    if (program.resize) {
        video.width  = program.resize.width;
        video.height = program.resize.height;
    }
    if (program.fps) {
        video.frameRate = program.fps.value;
    }
    if (program.encode) {
        const mapped = VIDEO_CODEC_MAP[program.encode.videoCodec];
        if (mapped) video.codec = mapped;
    }
    if (program.bitrate) {
        const bps = parseBitrateToBps(program.bitrate.value);
        if (bps !== undefined) video.bitrateBps = bps;
    }

    let audio: IRAudioConfig | undefined;
    if (program.audio) {
        const a = program.audio;
        audio = {};
        if (a.value) audio.externalFile = a.value;
        if (a.codec) {
            const mapped = AUDIO_CODEC_MAP[a.codec];
            if (mapped) audio.codec = mapped;
        }
        if (a.bitrate) {
            const bps = parseBitrateToBps(a.bitrate);
            if (bps !== undefined) audio.bitrateBps = bps;
        }
        if (a.samplerate) audio.sampleRate = a.samplerate;
        if (a.channels)   audio.channels = a.channels === 'stereo' ? 2 : 1;
        if (a.normalize) {
            const unit = a.normalize.unit.toLowerCase();
            if (unit === 'lufs') audio.normalizeLufs = a.normalize.value;
            else if (unit === 'dbtp') audio.normalizeDbtp = a.normalize.value;
        }
        if (a.eq) {
            const eq: { bass?: number; mid?: number; treble?: number } = {};
            if (a.eq.bass !== undefined) eq.bass = a.eq.bass;
            if (a.eq.mid !== undefined) eq.mid = a.eq.mid;
            if (a.eq.treble !== undefined) eq.treble = a.eq.treble;
            audio.eq = eq;
        }
        if (a.compress) audio.compress = { ...a.compress };
        if (a.reverb)   audio.reverb = a.reverb;
        if (a.fadein) {
            const sec = parseTimeToSeconds(a.fadein);
            if (sec !== undefined) audio.fadeInSeconds = sec;
        }
        if (a.fadeout) {
            const sec = parseTimeToSeconds(a.fadeout);
            if (sec !== undefined) audio.fadeOutSeconds = sec;
        }

        if (!audio.codec && program.encode) {
            const mapped = AUDIO_CODEC_MAP[program.encode.audioCodec];
            if (mapped) audio.codec = mapped;
        }
    } else if (program.encode) {
        const audioCodec = AUDIO_CODEC_MAP[program.encode.audioCodec];
        if (audioCodec) audio = { codec: audioCodec };
    }

    let watermark: IRWatermark | undefined;
    if (program.watermark) {
        watermark = {
            imagePath: program.watermark.file,
            position:  normalizeWatermarkPosition(program.watermark.position),
        };
    }

    const thumbnail = program.thumbnail
        ? { atSeconds: parseTimeToSeconds(program.thumbnail.value) ?? 0 }
        : undefined;

    const outputs: IROutput[] = program.outputs.map((out): IROutput => {
        const item: IROutput = {
            filename:  out.file,
            container: containerFromFilename(out.file),
        };
        const ov = buildOutputOverrides(out);
        if (ov) item.overrides = ov;
        return item;
    });

    const result: IR = {
        input:       program.input.value,
        outputs,
        video,
        isAudioOnly: isAudioOnlyFile(program.input.value),
        isV2:        false,
    };
    if (audio) result.audio = audio;
    if (watermark) result.watermark = watermark;
    if (thumbnail) result.thumbnail = thumbnail;

    return result;
}

// ── V2 Program → IR ──────────────────────────────────────────────────────────

function buildIRFromV2(program: ProgramV2): IR {
    const video: IRVideoConfig = {};
    if (program.resize) {
        video.width  = program.resize.width;
        video.height = program.resize.height;
    }
    if (program.fps) {
        video.frameRate = program.fps.value;
    }
    if (program.encode) {
        const mapped = VIDEO_CODEC_MAP[program.encode.videoCodec];
        if (mapped) video.codec = mapped;
    }
    if (program.bitrate) {
        const bps = parseBitrateToBps(program.bitrate.value);
        if (bps !== undefined) video.bitrateBps = bps;
    }

    let audio: IRAudioConfig | undefined;
    if (program.encode) {
        const audioCodec = AUDIO_CODEC_MAP[program.encode.audioCodec];
        if (audioCodec) audio = { codec: audioCodec };
    }

    let watermark: IRWatermark | undefined;
    if (program.watermark) {
        watermark = {
            imagePath: program.watermark.file,
            position:  normalizeWatermarkPosition(program.watermark.position),
        };
    }

    const thumbnail = program.thumbnail
        ? { atSeconds: parseTimeToSeconds(program.thumbnail.value) ?? 0 }
        : undefined;

    const outputs: IROutput[] = program.outputs.map((out): IROutput => ({
        filename:  out.file,
        container: containerFromFilename(out.file),
    }));

    const firstSource = Object.values(program.sources)[0];
    const inputFile = firstSource?.file ?? 'unknown';

    const result: IR = {
        input:       inputFile,
        outputs,
        video,
        isAudioOnly: isAudioOnlyFile(inputFile),
        isV2:        true,
    };
    if (audio) result.audio = audio;
    if (watermark) result.watermark = watermark;
    if (thumbnail) result.thumbnail = thumbnail;

    return result;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function buildIR(ast: Program | ProgramV2): IR {
    analyze(ast);

    if ('version' in ast && ast.version === 2) {
        return buildIRFromV2(ast as ProgramV2);
    }
    return buildIRFromV1(ast as Program);
}
