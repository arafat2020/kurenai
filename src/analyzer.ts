import { Program, VideoCodec, AudioCodec, WatermarkPosition } from "./parser";

export enum SupportedVideoFormat {
    MP4 = '.mp4',
    AVI = '.avi',
    MKV = '.mkv',
    MOV = '.mov',
    FLV = '.flv',
    WMV = '.wmv',
    WEBM = '.webm',
    MPEG = '.mpeg',
    MPG = '.mpg',
    M4V = '.m4v'
}

function analyzeInput(input: Program['input']): void {
    if (!input) {
        throw new Error("Input file is missing.");
    }

    const inputExtension = input.value.includes('.') 
        ? input.value.slice(input.value.lastIndexOf('.')).toLowerCase() 
        : '';
        
    const supportedFormats = Object.values(SupportedVideoFormat) as string[];
    
    if (!supportedFormats.includes(inputExtension)) {
        throw new Error(`Unsupported input format: ${inputExtension || 'No extension provided'}`);
    }
}

function analyzeOutput(output: Program['output']): void {
    if (!output) {
        throw new Error("Output file is missing.");
    }

    const outputExtension = output.value.includes('.') 
        ? output.value.slice(output.value.lastIndexOf('.')).toLowerCase() 
        : '';
        
    const supportedFormats = Object.values(SupportedVideoFormat) as string[];
    
    if (!supportedFormats.includes(outputExtension)) {
        throw new Error(`Unsupported output format: ${outputExtension || 'No extension provided'}`);
    }
}

function analyzeFps(fps: Program['fps']): void {
    if (!fps) return;

    if (fps.value <= 0 || fps.value > 240) {
        throw new Error(`Invalid FPS value: ${fps.value}. FPS must be a positive number between 1 and 240.`);
    }
}

function analyzeResize(resize: Program['resize']): void {
    if (!resize) return;

    if (resize.width <= 0 || resize.height <= 0) {
        throw new Error(`Invalid resize values: ${resize.width}x${resize.height}. Width and height must be greater than 0.`);
    }

    if (resize.width % 2 !== 0 || resize.height % 2 !== 0) {
        throw new Error(`Invalid resize values: ${resize.width}x${resize.height}. Width and height must be divisible by 2 for ffmpeg compatibility.`);
    }
}

function analyzeEncode(encode: Program['encode']): void {
    if (!encode) return;

    const supportedVideoCodecs = Object.values(VideoCodec) as string[];
    if (!supportedVideoCodecs.includes(encode.videoCodec)) {
        throw new Error(`Unsupported video codec: ${encode.videoCodec}`);
    }

    const supportedAudioCodecs = Object.values(AudioCodec) as string[];
    if (!supportedAudioCodecs.includes(encode.audioCodec)) {
        throw new Error(`Unsupported audio codec: ${encode.audioCodec}`);
    }
}

function analyzeWatermark(watermark: Program['watermark']): void {
    if (!watermark) return;

    if (!watermark.file || watermark.file.trim() === '') {
        throw new Error("Watermark file path cannot be empty.");
    }

    const supportedPositions = Object.values(WatermarkPosition) as string[];
    if (!supportedPositions.includes(watermark.position)) {
        throw new Error(`Unsupported watermark position: ${watermark.position}`);
    }
}

export function analyze(code: Program): void {
    analyzeInput(code.input);
    analyzeOutput(code.output);
    analyzeFps(code.fps);
    analyzeResize(code.resize);
    analyzeEncode(code.encode);
    analyzeWatermark(code.watermark);
}