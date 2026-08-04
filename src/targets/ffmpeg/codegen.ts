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

// ── Bitrate formatting ────────────────────────────────────────────────────────

function bpsToFFmpegBitrate(bps: number): string {
    if (bps >= 1_000_000) {
        return `${Math.round(bps / 1_000)}k`;
    }
    return `${bps}`;
}

// ── Audio filter builder ──────────────────────────────────────────────────────

function buildAudioFilters(audio: IRAudioConfig, hasExternalFile: boolean): string[] {
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

    return filters;
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

    let cmd = 'ffmpeg';
    if (trimStart !== undefined) cmd += ` -ss ${trimStart}`;
    if (trimEnd   !== undefined) cmd += ` -to ${trimEnd}`;
    cmd += ` -i ${ir.input}`;

    if (audio?.externalFile) {
        cmd += ` -i ${audio.externalFile}`;
    }

    if (watermark && !ir.isAudioOnly) {
        cmd += ` -i ${watermark.imagePath}`;
    }

    let outOptions = '';
    const vfFilters: string[] = [];

    if (!ir.isAudioOnly) {
        if (video.width !== undefined && video.height !== undefined) {
            vfFilters.push(`scale=${video.width}:${video.height}`);
        }
        if (video.frameRate !== undefined) {
            vfFilters.push(`fps=${video.frameRate}`);
        }
    }

    if (vfFilters.length > 0) {
        outOptions += ` -vf "${vfFilters.join(',')}"`;
    }

    if (video.codec && !ir.isAudioOnly) {
        const ffmpegCodec = VIDEO_CODEC_TO_FFMPEG[video.codec] ?? video.codec;
        outOptions += ` -c:v ${ffmpegCodec}`;
    }
    if (audio?.codec) {
        outOptions += ` -c:a ${audio.codec}`;
    }

    if (video.bitrateBps !== undefined) {
        outOptions += ` -b:v ${bpsToFFmpegBitrate(video.bitrateBps)}`;
    }

    if (audio) {
        if (audio.bitrateBps !== undefined) outOptions += ` -b:a ${bpsToFFmpegBitrate(audio.bitrateBps)}`;
        if (audio.sampleRate !== undefined) outOptions += ` -ar ${audio.sampleRate}`;
        if (audio.channels   !== undefined) outOptions += ` -ac ${audio.channels}`;

        const afFilters = buildAudioFilters(audio, !!audio.externalFile);
        if (afFilters.length > 0) {
            outOptions += ` -af "${afFilters.join(',')}"`;
        }
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

        if (ir.thumbnail && this.trimStart === undefined && this.trimEnd === undefined) {
            const inputFile = ir.input;
            const ts = ir.thumbnail.atSeconds;
            commands.push(`ffmpeg -i ${inputFile} -ss ${ts} -frames:v 1 thumb.jpg`);
        }

        return { target: "ffmpeg", commands };
    }
}
