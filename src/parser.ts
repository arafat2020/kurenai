import { lexer, type Token } from "./lexer.js";

// AST Node Types
interface ASTNode {
    type: string;
    line: number;
}

// Codec Enums
enum VideoCodec {
    H264 = 'h264',
    H265 = 'h265',
    VP8 = 'vp8',
    VP9 = 'vp9',
    AV1 = 'av1',
    MPEG2VIDEO = 'mpeg2video',
    THEORA = 'theora',
}

enum AudioCodec {
    AAC = 'aac',
    MP3 = 'mp3',
    OPUS = 'opus',
    VORBIS = 'vorbis',
    FLAC = 'flac',
    PCM = 'pcm_s16le',
    AC3 = 'ac3',
}

enum WatermarkPosition {
    TOP_LEFT = 'top-left',
    TOP_RIGHT = 'top-right',
    BOTTOM_LEFT = 'bottom-left',
    BOTTOM_RIGHT = 'bottom-right',
}

interface InputNode extends ASTNode {
    type: 'INPUT';
    value: string;
}

interface OutputNode extends ASTNode {
    type: 'OUTPUT';
    value: string;
}

interface ResizeNode extends ASTNode {
    type: 'RESIZE';
    width: number;
    height: number;
}

interface FpsNode extends ASTNode {
    type: 'FPS';
    value: number;
}

interface EncodeNode extends ASTNode {
    type: 'ENCODE';
    videoCodec: VideoCodec;
    audioCodec: AudioCodec;
}

interface BitrateNode extends ASTNode {
    type: 'BITRATE';
    value: string;
}

interface AudioNode extends ASTNode {
    type: 'AUDIO';
    value: string;
}

interface WatermarkNode extends ASTNode {
    type: 'WATERMARK';
    file: string;
    position: WatermarkPosition;
}

interface ThumbnailNode extends ASTNode {
    type: 'THUMBNAIL';
    value: string;
}

interface Program extends ASTNode {
    input: InputNode;
    output: OutputNode;
    resize?: ResizeNode;
    fps?: FpsNode;
    encode?: EncodeNode;
    bitrate?: BitrateNode;
    audio?: AudioNode;
    watermark?: WatermarkNode;
    thumbnail?: ThumbnailNode;
}


const parseTokens = (tokens: Token[]): Program => {
    // Initialize empty program
    const program: Partial<Program> = {}

    // Loop through tokens
    let i = 0;
    while (i < tokens.length) {
        const token = tokens[i];

        if (!token) {
            break;
        }

        if (token.type === 'KEYWORD') {
            const keyword = token.value;

            switch (keyword) {
                case 'input':
                    const nextInputToken = tokens[i + 1];

                    if (nextInputToken === undefined || nextInputToken.type !== 'STRING') {
                        throw new Error("File source is required");
                    }
                    program.input = {
                        type: 'INPUT',
                        value: nextInputToken.value.replace(/"/g, ''),
                        line: token.line
                    }
                    i++;
                    break;
                case 'output':
                    const nextOutputToken = tokens[i + 1];

                    if (nextOutputToken === undefined) {
                        throw new Error("File source is required");
                    }
                    if (nextOutputToken.type !== 'STRING') {
                        throw new Error("Value must be a valid source");
                    }

                    program.output = {
                        type: 'OUTPUT',
                        value: nextOutputToken.value.replace(/"/g, ''),
                        line: token.line
                    }
                    i++;
                    break;
                case 'resize':
                    const nextResizeToken = tokens[i + 1];
                    if (nextResizeToken === undefined) {
                        throw new Error("Resize value is required");
                    }
                    if (nextResizeToken.type !== 'RESOLUTION') {
                        throw new Error("Resolution Value must be a valid source. Eg 1280x720");
                    }
                    const splitResolutionValue = tokens[i + 1]?.value.split("x")
                    if (!splitResolutionValue || splitResolutionValue.length !== 2) {
                        throw new Error("Resolution value must be in the format WIDTHxHEIGHT. Eg 1280x720");
                    }
                    program.resize = {
                        type: "RESIZE",
                        width: parseInt(splitResolutionValue[0]!),
                        height: parseInt(splitResolutionValue[1]!),
                        line: token.line
                    }
                    i++;
                    break;
                case 'fps':
                    const nextFpsToken = tokens[i + 1];
                    if (nextFpsToken === undefined) {
                        throw new Error("FPS value is required");
                    }
                    if (nextFpsToken.type !== 'NUMBER') {
                        throw new Error("FPS value must be a number");
                    }
                    program.fps = {
                        type: "FPS",
                        value: parseInt(nextFpsToken.value),
                        line: token.line
                    }
                    i++;
                    break;
                case 'encode':
                    const nextEncodeToken = tokens[i + 1];
                    const nextNextEncodeToken = tokens[i + 2];

                    if (nextEncodeToken === undefined || nextNextEncodeToken === undefined) {
                        throw new Error("Both video and audio codecs are required for encoding");
                    }
                    if (nextEncodeToken.type !== 'IDENTIFIER' || nextNextEncodeToken.type !== 'IDENTIFIER') {
                        throw new Error("Codec values must be valid keywords");
                    }

                    const videoCodec = nextEncodeToken.value as VideoCodec;
                    const audioCodec = nextNextEncodeToken.value as AudioCodec;
                    program.encode = {
                        type: "ENCODE",
                        videoCodec,
                        audioCodec,
                        line: token.line
                    }
                    i += 2;
                    break;
                case 'bitrate':
                    const nextBitrateToken = tokens[i + 1];
                    if (nextBitrateToken === undefined) {
                        throw new Error("Bitrate value is required");
                    }
                    if (nextBitrateToken.type !== 'BITRATE') {
                        throw new Error("Bitrate value must be a string with units, e.g. '500k' or '2M'");
                    }
                    program.bitrate = {
                        type: "BITRATE",
                        value: nextBitrateToken.value,
                        line: token.line
                    }
                    i++;
                    break;
                case 'audio':
                    const nextAudioToken = tokens[i + 1];
                    if (nextAudioToken === undefined) {
                        throw new Error("Audio value is required");
                    }
                    if (nextAudioToken.type !== 'IDENTIFIER') {
                        throw new Error("Audio value must be a string with the audio file path, e.g. 'audio.mp3'");
                    }
                    program.audio = {
                        type: "AUDIO",
                        value: nextAudioToken.value.replace(/"/g, ''),
                        line: token.line
                    }
                    i++;
                    break;
                case 'watermark':
                    const nextWatermarkToken = tokens[i + 1];
                    const nextNextWatermarkToken = tokens[i + 2];

                    if (nextWatermarkToken === undefined || nextNextWatermarkToken === undefined) {
                        throw new Error("Both watermark file and position are required for watermarking");
                    }
                    if (nextWatermarkToken.type !== 'STRING' || nextNextWatermarkToken.type !== 'IDENTIFIER') {
                        throw new Error("Watermark file must be a string and position must be a valid keyword");
                    }

                    const watermarkFile = nextWatermarkToken.value.replace(/"/g, '');
                    const watermarkPosition = nextNextWatermarkToken.value as WatermarkPosition;
                    program.watermark = {
                        type: "WATERMARK",
                        file: watermarkFile,
                        position: watermarkPosition,
                        line: token.line
                    }
                    i += 2;
                    break;
                case 'thumbnail':
                    const nextThumbnailToken = tokens[i + 1];
                    if (nextThumbnailToken === undefined) {
                        throw new Error("Thumbnail value is required");
                    }
                    if (nextThumbnailToken.type !== 'TIME') {
                        throw new Error("Thumbnail value must be a time value, e.g. '5s'");
                    }
                    program.thumbnail = {
                        type: "THUMBNAIL",
                        value: nextThumbnailToken.value,
                        line: token.line
                    }
                    i++;
                    break;
                default:
                    throw new Error(`Unknown keyword: ${keyword} at line ${token.line}`);
            }
        } else {
            throw new Error(`Unexpected token "${token.value}" at line ${token.line}`);
        }

        i++;
    }

    return program as Program;
}

export { parseTokens };