import { Program, VideoCodec, AudioCodec, WatermarkPosition } from "./parser.js";
import { CompilerError } from "./errors.js";

/**
 * Defines the video file extensions supported by Kurenai.
 */
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

/**
 * Defines the audio file extensions supported by Kurenai.
 */
export enum SupportedAudioFormat {
    MP3 = '.mp3',
    WAV = '.wav',
    AAC = '.aac',
    FLAC = '.flac',
    OGG = '.ogg',
    M4A = '.m4a',
    OPUS = '.opus',
    WMA = '.wma',
    AIFF = '.aiff'
}

/**
 * Validates the input file node to ensure it exists and has a supported extension.
 * @param input The parsed InputNode
 * @param program The root Program AST
 * @throws CompilerError if input is missing or format is unsupported
 */
function analyzeInput(input: Program['input'], program: Program): void {
    if (!input) {
        throw new CompilerError("Input file is missing.", program.line, program.column, program.length);
    }

    const inputExtension = input.value.includes('.') 
        ? input.value.slice(input.value.lastIndexOf('.')).toLowerCase() 
        : '';
        
    const supportedVideoFormats = Object.values(SupportedVideoFormat) as string[];
    const supportedAudioFormats = Object.values(SupportedAudioFormat) as string[];
    const supportedFormats = [...supportedVideoFormats, ...supportedAudioFormats];
    
    if (!supportedFormats.includes(inputExtension)) {
        throw new CompilerError(`Unsupported input format: ${inputExtension || 'No extension provided'}`, input.line, input.column, input.length);
    }
}

/**
 * Validates the output file node to ensure it exists and has a supported extension.
 * @param output The parsed OutputNode
 * @param program The root Program AST
 * @throws CompilerError if output is missing or format is unsupported
 */
function analyzeOutput(output: Program['outputs'][number], program: Program): void {
    if (!output) {
        throw new CompilerError("Output block is missing.", program.line, program.column, program.length);
    }

    const outputExtension = output.file.includes('.') 
        ? output.file.slice(output.file.lastIndexOf('.')).toLowerCase() 
        : '';
        
    const supportedVideoFormats = Object.values(SupportedVideoFormat) as string[];
    const supportedAudioFormats = Object.values(SupportedAudioFormat) as string[];
    const supportedFormats = [...supportedVideoFormats, ...supportedAudioFormats];
    
    if (!supportedFormats.includes(outputExtension)) {
        throw new CompilerError(`Unsupported output format: ${outputExtension || 'No extension provided'}`, output.line, output.column, output.length);
    }
}

/**
 * Validates the frames per second (FPS) configuration.
 * FPS must be a reasonable positive number (between 1 and 240).
 * @param fps The parsed FpsNode
 * @throws CompilerError if FPS is out of bounds
 */
function analyzeFps(fps: Program['fps']): void {
    if (!fps) return;

    if (fps.value <= 0 || fps.value > 240) {
        throw new CompilerError(`Invalid FPS value: ${fps.value}. FPS must be a positive number between 1 and 240.`, fps.line, fps.column, fps.length);
    }
}

/**
 * Validates the resize (resolution) configuration.
 * Width and height must be positive and divisible by 2 (required by many video encoders).
 * @param resize The parsed ResizeNode
 * @throws CompilerError if dimensions are invalid or not divisible by 2
 */
function analyzeResize(resize: Program['resize']): void {
    if (!resize) return;

    if (resize.width <= 0 || resize.height <= 0) {
        throw new CompilerError(`Invalid resize values: ${resize.width}x${resize.height}. Width and height must be greater than 0.`, resize.line, resize.column, resize.length);
    }

    if (resize.width % 2 !== 0 || resize.height % 2 !== 0) {
        throw new CompilerError(`Invalid resize values: ${resize.width}x${resize.height}. Width and height must be divisible by 2 for ffmpeg compatibility.`, resize.line, resize.column, resize.length);
    }
}

/**
 * Validates the chosen video and audio codecs against the supported lists.
 * @param encode The parsed EncodeNode
 * @throws CompilerError if an unsupported codec is provided
 */
function analyzeEncode(encode: Program['encode']): void {
    if (!encode) return;

    const supportedVideoCodecs = Object.values(VideoCodec) as string[];
    if (!supportedVideoCodecs.includes(encode.videoCodec)) {
        throw new CompilerError(`Unsupported video codec: ${encode.videoCodec}`, encode.line, encode.column, encode.length);
    }

    const supportedAudioCodecs = Object.values(AudioCodec) as string[];
    if (!supportedAudioCodecs.includes(encode.audioCodec)) {
        throw new CompilerError(`Unsupported audio codec: ${encode.audioCodec}`, encode.line, encode.column, encode.length);
    }
}

/**
 * Validates the watermark configuration, ensuring the file path is provided
 * and the position is a known valid position.
 * @param watermark The parsed WatermarkNode
 * @throws CompilerError if file path is empty or position is unsupported
 */
function analyzeWatermark(watermark: Program['watermark']): void {
    if (!watermark) return;

    if (!watermark.file || watermark.file.trim() === '') {
        throw new CompilerError("Watermark file path cannot be empty.", watermark.line, watermark.column, watermark.length);
    }

    const supportedPositions = Object.values(WatermarkPosition) as string[];
    if (!supportedPositions.includes(watermark.position)) {
        throw new CompilerError(`Unsupported watermark position: ${watermark.position}`, watermark.line, watermark.column, watermark.length);
    }
}

/**
 * The main analyzer function. 
 * Traverses the parsed Program AST and performs semantic validation on all configurations.
 * If any configuration is invalid, it throws a descriptive error.
 * 
 * @param code The fully parsed Program AST
 */
export function analyze(code: Program): void {
    analyzeInput(code.input, code);
    if (!code.outputs || code.outputs.length === 0) {
        throw new CompilerError("Output file is missing.", code.line, code.column, code.length);
    }
    for (const output of code.outputs) {
        analyzeOutput(output, code);
    }
    analyzeFps(code.fps);
    analyzeResize(code.resize);
    analyzeEncode(code.encode);
    analyzeWatermark(code.watermark);
}