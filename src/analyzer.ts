import { Program, VideoCodec, AudioCodec, WatermarkPosition } from "./parser";

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
 * Validates the input file node to ensure it exists and has a supported extension.
 * @param input The parsed InputNode
 * @throws Error if input is missing or format is unsupported
 */
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

/**
 * Validates the output file node to ensure it exists and has a supported extension.
 * @param output The parsed OutputNode
 * @throws Error if output is missing or format is unsupported
 */
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

/**
 * Validates the frames per second (FPS) configuration.
 * FPS must be a reasonable positive number (between 1 and 240).
 * @param fps The parsed FpsNode
 * @throws Error if FPS is out of bounds
 */
function analyzeFps(fps: Program['fps']): void {
    if (!fps) return;

    if (fps.value <= 0 || fps.value > 240) {
        throw new Error(`Invalid FPS value: ${fps.value}. FPS must be a positive number between 1 and 240.`);
    }
}

/**
 * Validates the resize (resolution) configuration.
 * Width and height must be positive and divisible by 2 (required by many video encoders).
 * @param resize The parsed ResizeNode
 * @throws Error if dimensions are invalid or not divisible by 2
 */
function analyzeResize(resize: Program['resize']): void {
    if (!resize) return;

    if (resize.width <= 0 || resize.height <= 0) {
        throw new Error(`Invalid resize values: ${resize.width}x${resize.height}. Width and height must be greater than 0.`);
    }

    if (resize.width % 2 !== 0 || resize.height % 2 !== 0) {
        throw new Error(`Invalid resize values: ${resize.width}x${resize.height}. Width and height must be divisible by 2 for ffmpeg compatibility.`);
    }
}

/**
 * Validates the chosen video and audio codecs against the supported lists.
 * @param encode The parsed EncodeNode
 * @throws Error if an unsupported codec is provided
 */
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

/**
 * Validates the watermark configuration, ensuring the file path is provided
 * and the position is a known valid position.
 * @param watermark The parsed WatermarkNode
 * @throws Error if file path is empty or position is unsupported
 */
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

/**
 * The main analyzer function. 
 * Traverses the parsed Program AST and performs semantic validation on all configurations.
 * If any configuration is invalid, it throws a descriptive error.
 * 
 * @param code The fully parsed Program AST
 */
export function analyze(code: Program): void {
    analyzeInput(code.input);
    analyzeOutput(code.output);
    analyzeFps(code.fps);
    analyzeResize(code.resize);
    analyzeEncode(code.encode);
    analyzeWatermark(code.watermark);
}