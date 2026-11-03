import {
    type IR,
    type IRVideoConfig,
    type IRAudioConfig,
} from "../../ir/types.js";
import {
    type ICodeGenerator,
    type FFmpegOutput,
} from "../target.interface.js";

// ── Codec maps ────────────────────────────────────────────────────────────────

const VIDEO_CODEC_TO_FFMPEG: Record<string, string> = {
    h264:        'libx264',
    h265:        'libx265',
    vp8:         'libvpx',
    vp9:         'libvpx-vp9',
    av1:         'libaom-av1',
    mpeg2video:  'mpeg2video',
    theora:      'libtheora',
};

const POSITION_TO_OVERLAY: Record<string, string> = {
    'top-left':     '10:10',
    'top-right':    'main_w-overlay_w-10:10',
    'bottom-left':  '10:main_h-overlay_h-10',
    'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10',
    'center':       '(main_w-overlay_w)/2:(main_h-overlay_h)/2',
};

const ROTATE_FILTER: Record<90 | 180 | 270, string> = {
    90:  'transpose=1',
    180: 'transpose=1,transpose=1',
    270: 'transpose=2',
};

// ── Bitrate formatting ────────────────────────────────────────────────────────

function bpsToFFmpegBitrate(bps: number): string {
    if (bps >= 1_000_000) {
        return `${Math.round(bps / 1_000)}k`;
    }
    return `${bps}`;
}

/** Split speed into chained atempo filters (each must be 0.5–2.0). */
function buildAtempoChain(speed: number): string[] {
    const filters: string[] = [];
    let remaining = speed;
    while (remaining > 2.0) {
        filters.push('atempo=2.0');
        remaining /= 2.0;
    }
    while (remaining < 0.5) {
        filters.push('atempo=0.5');
        remaining /= 0.5;
    }
    filters.push(`atempo=${Number(remaining.toFixed(4))}`);
    return filters;
}

// ── Audio filter builder ──────────────────────────────────────────────────────

function buildAudioFilters(
    audio: IRAudioConfig,
    hasExternalFile: boolean,
    speed?: number,
): string[] {
    const filters: string[] = [];

    if (hasExternalFile) {
        filters.push('amix=inputs=2:duration=first');
    }

    if (audio.normalizeLufs !== undefined) {
        filters.push(`loudnorm=I=${audio.normalizeLufs}`);
    } else if (audio.normalizeDbtp !== undefined) {
        filters.push(`loudnorm=TP=${audio.normalizeDbtp}`);
    }

    if (audio.eq) {
        const { bass, mid, treble } = audio.eq;
        if (bass    !== undefined) filters.push(`equalizer=f=100:width_type=o:width=2:g=${bass}`);
        if (mid     !== undefined) filters.push(`equalizer=f=1000:width_type=o:width=2:g=${mid}`);
        if (treble  !== undefined) filters.push(`equalizer=f=10000:width_type=o:width=2:g=${treble}`);
    }

    if (audio.compress) {
        const { threshold, ratio, attack, release } = audio.compress;
        const parts: string[] = [];
        if (threshold !== undefined) parts.push(`threshold=${threshold}dB`);
        if (ratio     !== undefined) parts.push(`ratio=${ratio}`);
        if (attack    !== undefined) parts.push(`attack=${attack}`);
        if (release   !== undefined) parts.push(`release=${release}`);
        if (parts.length > 0) filters.push(`acompressor=${parts.join(':')}`);
    }

    if (audio.reverb) {
        const reverbMap: Record<string, string> = {
            subtle: 'aecho=0.8:0.8:20:0.1',
            medium: 'aecho=0.8:0.8:60:0.3',
            large:  'aecho=0.8:0.8:120:0.5',
        };
        const filter = reverbMap[audio.reverb];
        if (filter) filters.push(filter);
    }

    if (audio.fadeInSeconds !== undefined) {
        filters.push(`afade=t=in:st=0:d=${audio.fadeInSeconds}`);
    }
    if (audio.fadeOutSeconds !== undefined) {
        filters.push(`afade=t=out:st=99999:d=${audio.fadeOutSeconds}`);
    }

    if (speed !== undefined && speed !== 1) {
        filters.push(...buildAtempoChain(speed));
    }

    return filters;
}

function buildVideoFilters(video: IRVideoConfig, isAudioOnly: boolean): string[] {
    if (isAudioOnly) return [];

    const vfFilters: string[] = [];

    if (video.crop) {
        const { width, height, x, y } = video.crop;
        if (x !== undefined && y !== undefined) {
            vfFilters.push(`crop=${width}:${height}:${x}:${y}`);
        } else {
            vfFilters.push(`crop=${width}:${height}`);
        }
    }

    if (video.width !== undefined && video.height !== undefined) {
        vfFilters.push(`scale=${video.width}:${video.height}`);
    }
    if (video.frameRate !== undefined) {
        vfFilters.push(`fps=${video.frameRate}`);
    }
    if (video.rotate !== undefined) {
        vfFilters.push(ROTATE_FILTER[video.rotate]);
    }
    if (video.flip === 'horizontal') {
        vfFilters.push('hflip');
    } else if (video.flip === 'vertical') {
        vfFilters.push('vflip');
    }
    if (video.speed !== undefined && video.speed !== 1) {
        const factor = Number((1 / video.speed).toFixed(6));
        vfFilters.push(`setpts=${factor}*PTS`);
    }

    return vfFilters;
}

// ── Per-output command builder ────────────────────────────────────────────────

interface BuildCommandOptions {
    ir: IR;
    outputIndex: number;
    trimStart?: number;
    trimEnd?: number;
}

function buildSingleOutputCommand(opts: BuildCommandOptions): string {
    const { ir, outputIndex, trimStart, trimEnd } = opts;
    const out = ir.outputs[outputIndex]!;

    const videoOverride = out.overrides?.video;
    const audioOverride = out.overrides?.audio;
    const watermarkOverride = out.overrides?.watermark;

    const video: IRVideoConfig = { ...ir.video, ...videoOverride };
    const audio: IRAudioConfig | undefined = audioOverride
        ? { ...ir.audio, ...audioOverride }
        : ir.audio;
    const watermark = watermarkOverride ?? ir.watermark;

    const effectiveTrimStart = trimStart ?? ir.trim?.startSeconds;
    const effectiveTrimEnd = trimEnd ?? ir.trim?.endSeconds;

    let cmd = 'ffmpeg';
    if (effectiveTrimStart !== undefined) cmd += ` -ss ${effectiveTrimStart}`;
    if (effectiveTrimEnd   !== undefined) cmd += ` -to ${effectiveTrimEnd}`;
    cmd += ` -i ${ir.input}`;

    if (audio?.externalFile && !ir.mute) {
        cmd += ` -i ${audio.externalFile}`;
    }

    if (watermark && !ir.isAudioOnly) {
        cmd += ` -i ${watermark.imagePath}`;
    }

    let outOptions = '';
    const vfFilters = buildVideoFilters(video, ir.isAudioOnly);

    if (vfFilters.length > 0) {
        outOptions += ` -vf "${vfFilters.join(',')}"`;
    }

    if (video.codec && !ir.isAudioOnly) {
        const ffmpegCodec = VIDEO_CODEC_TO_FFMPEG[video.codec] ?? video.codec;
        outOptions += ` -c:v ${ffmpegCodec}`;
    }
    if (video.preset && !ir.isAudioOnly) {
        outOptions += ` -preset ${video.preset}`;
    }
    if (video.crf !== undefined && !ir.isAudioOnly) {
        outOptions += ` -crf ${video.crf}`;
    } else if (video.bitrateBps !== undefined) {
        outOptions += ` -b:v ${bpsToFFmpegBitrate(video.bitrateBps)}`;
    }

    if (ir.mute) {
        outOptions += ' -an';
    } else if (audio?.codec) {
        outOptions += ` -c:a ${audio.codec}`;
    }

    if (audio && !ir.mute) {
        if (audio.bitrateBps !== undefined) outOptions += ` -b:a ${bpsToFFmpegBitrate(audio.bitrateBps)}`;
        if (audio.sampleRate !== undefined) outOptions += ` -ar ${audio.sampleRate}`;
        if (audio.channels   !== undefined) outOptions += ` -ac ${audio.channels}`;

        const afFilters = buildAudioFilters(audio, !!audio.externalFile, video.speed);
        if (afFilters.length > 0) {
            outOptions += ` -af "${afFilters.join(',')}"`;
        }
    } else if (!ir.mute && video.speed !== undefined && video.speed !== 1) {
        // Speed without an audio block still needs atempo when audio is present
        const afFilters = buildAtempoChain(video.speed);
        outOptions += ` -af "${afFilters.join(',')}"`;
    }

    if (watermark && !ir.isAudioOnly) {
        const overlay = POSITION_TO_OVERLAY[watermark.position] ?? '10:10';
        outOptions += ` -filter_complex "overlay=${overlay}"`;
    }

    cmd += `${outOptions} ${out.filename}`;
    return cmd;
}

// ── Generator class ───────────────────────────────────────────────────────────

export class FFmpegCodeGenerator implements ICodeGenerator<FFmpegOutput> {
    constructor(
        private readonly trimStart?: number,
        private readonly trimEnd?: number,
    ) {}

    generate(ir: IR): FFmpegOutput {
        const commands: string[] = [];

        for (let i = 0; i < ir.outputs.length; i++) {
            const opts: BuildCommandOptions = { ir, outputIndex: i };
            if (this.trimStart !== undefined) opts.trimStart = this.trimStart;
            if (this.trimEnd !== undefined) opts.trimEnd = this.trimEnd;
            commands.push(buildSingleOutputCommand(opts));
        }

        const hasCliTrim = this.trimStart !== undefined || this.trimEnd !== undefined;
        if (ir.thumbnail && !hasCliTrim && !ir.trim) {
            const inputFile = ir.input;
            const ts = ir.thumbnail.atSeconds;
            commands.push(`ffmpeg -i ${inputFile} -ss ${ts} -frames:v 1 thumb.jpg`);
        }

        return { target: "ffmpeg", commands };
    }
}
