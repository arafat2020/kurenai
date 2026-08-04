import {
    type IR,
    type IRVideoConfig,
    type IRAudioConfig,
    type IROutput,
    type CanonicalVideoCodec,
    type CanonicalAudioCodec,
} from "../../ir/types.js";
import {
    type ICodeGenerator,
    type WebCodecsOutput,
    type WebCodecsPipelinePlan,
    type WebCodecsPipelineVideoConfig,
    type WebCodecsPipelineAudioConfig,
    type WebCodecsPipelineOutputConfig,
} from "../target.interface.js";
import { CompilerError } from "../../errors.js";

// ── Codec translation ─────────────────────────────────────────────────────────

const VIDEO_CODEC_TO_WEBCODECS: Record<CanonicalVideoCodec, string | null> = {
    h264:       'avc',
    h265:       'hevc',
    vp8:        'vp8',
    vp9:        'vp09',
    av1:        'av01',
    mpeg2video: null,
    theora:     null,
};

const AUDIO_CODEC_TO_WEBCODECS: Record<CanonicalAudioCodec, string | null> = {
    aac:       'aac',
    mp3:       'mp3',
    opus:      'opus',
    vorbis:    'vorbis',
    flac:      'flac',
    pcm_s16le: null,
    ac3:       null,
};

const SUPPORTED_WEBCODECS_CONTAINERS = new Set<string>(['mp4', 'webm']);

function mergedVideoConfig(ir: IR, out: IROutput): IRVideoConfig {
    return { ...ir.video, ...out.overrides?.video };
}

function mergedAudioConfig(ir: IR, out: IROutput): IRAudioConfig | undefined {
    if (!ir.audio && !out.overrides?.audio) return undefined;
    return { ...ir.audio, ...out.overrides?.audio };
}

function buildOutputPlan(
    ir: IR,
    out: IROutput,
    outputIndex: number,
): WebCodecsPipelineOutputConfig {
    const container = out.container;

    if (!SUPPORTED_WEBCODECS_CONTAINERS.has(container)) {
        throw new CompilerError(
            `WebCodecs target does not support the "${container}" container format. ` +
            `Use an .mp4 or .webm output, or compile with { target: "ffmpeg" }.`,
            1, 1, 0,
        );
    }

    const videoConfig = mergedVideoConfig(ir, out);
    const audioConfig = mergedAudioConfig(ir, out);

    let video: WebCodecsPipelineVideoConfig | undefined;
    if (!ir.isAudioOnly && videoConfig.codec) {
        const webCodecsCodec = VIDEO_CODEC_TO_WEBCODECS[videoConfig.codec];
        if (webCodecsCodec === null) {
            throw new CompilerError(
                `Video codec "${videoConfig.codec}" is not supported by WebCodecs. ` +
                `Supported codecs are: h264, h265, vp8, vp9, av1. ` +
                `Compile with { target: "ffmpeg" } to use this codec.`,
                1, 1, 0,
            );
        }
        if (webCodecsCodec !== null) {
            const v: WebCodecsPipelineVideoConfig = {
                codec:               webCodecsCodec,
                hardwareAcceleration: 'prefer-software',
            };
            if (videoConfig.width !== undefined) v.width = videoConfig.width;
            if (videoConfig.height !== undefined) v.height = videoConfig.height;
            if (videoConfig.frameRate !== undefined) v.frameRate = videoConfig.frameRate;
            if (videoConfig.bitrateBps !== undefined) v.bitrateBps = videoConfig.bitrateBps;
            video = v;
        }
    }

    let audio: WebCodecsPipelineAudioConfig | undefined;
    if (audioConfig?.codec) {
        const webCodecsAudioCodec = AUDIO_CODEC_TO_WEBCODECS[audioConfig.codec];
        if (webCodecsAudioCodec === null) {
            throw new CompilerError(
                `Audio codec "${audioConfig.codec}" is not supported by WebCodecs. ` +
                `Supported codecs are: aac, mp3, opus, vorbis, flac. ` +
                `Compile with { target: "ffmpeg" } to use this codec.`,
                1, 1, 0,
            );
        }
        if (webCodecsAudioCodec !== null) {
            const a: WebCodecsPipelineAudioConfig = {
                codec: webCodecsAudioCodec,
            };
            if (audioConfig.bitrateBps !== undefined) a.bitrateBps = audioConfig.bitrateBps;
            if (audioConfig.sampleRate !== undefined) a.sampleRate = audioConfig.sampleRate;
            if (audioConfig.channels !== undefined) a.channels = audioConfig.channels;
            audio = a;
        }
    }

    const plan: WebCodecsPipelineOutputConfig = {
        filename:  out.filename,
        container: container as "mp4" | "webm",
    };
    if (video) plan.video = video;
    if (audio) plan.audio = audio;

    return plan;
}

export class WebCodecsCodeGenerator implements ICodeGenerator<WebCodecsOutput> {
    generate(ir: IR): WebCodecsOutput {
        if (ir.isV2) {
            throw new CompilerError(
                'WebCodecs target does not support V2 scripts (source/clip/timeline/mix). ' +
                'Use { target: "ffmpeg" } for V2 scripts, or simplify your script to a ' +
                'single input/output for the WebCodecs target.',
                1, 1, 0,
            );
        }

        const outputs: WebCodecsPipelineOutputConfig[] = ir.outputs.map(
            (out, i) => buildOutputPlan(ir, out, i),
        );

        const plan: WebCodecsPipelinePlan = { outputs };

        if (ir.video.codec) {
            plan.sourceVideoCodec = ir.video.codec;
        }
        if (ir.audio?.codec) {
            plan.sourceAudioCodec = ir.audio.codec;
        }

        if (ir.thumbnail) {
            console.warn(
                '[kurenai/webcodecs] Thumbnail extraction is not supported by the WebCodecs ' +
                'target and will be skipped. Use { target: "ffmpeg" } if thumbnail extraction is needed.',
            );
            plan.thumbnail = ir.thumbnail;
        }

        return { target: "webcodecs", plan };
    }
}
