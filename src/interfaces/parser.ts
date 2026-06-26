import { VideoCodec, AudioCodec, WatermarkPosition, NormalizeUnit, Reverb, AudioChannel } from "../enums/parser.js";

/**
 * Base interface for all Abstract Syntax Tree (AST) nodes.
 * Every parsed element implements this so we can track its line number.
 */
interface ASTNode {
    type: string;
    line: number;
    column: number;
    length: number;
}


/**
 * Represents a single input file in the AST.
 * The input file is mandatory and must be specified at the top of the script.
 */
interface InputNode extends ASTNode {
    type: 'INPUT';
    value: string;
}

/** Represents a single output block in the AST.
 * Each output block can have its own configuration, which overrides global settings.
 */
interface OutputBlockNode extends ASTNode {
    type: 'OUTPUT_BLOCK';
    file: string;
    overrides: Partial<Pick<Program, 'resize' | 'fps' | 'encode' | 'bitrate' | 'audio' | 'watermark' | 'thumbnail'>>;
}

// interface OutputNode extends ASTNode {
//     type: 'OUTPUT';
//     value: string;
// }

/**
 * Represents a resize command in the AST.
 */
interface ResizeNode extends ASTNode {
    type: 'RESIZE';
    width: number;
    height: number;
}

/** 
 * Represents an FPS command in the AST.
 */
interface FpsNode extends ASTNode {
    type: 'FPS';
    value: number;
}

/** 
 * Represents an encode command in the AST, specifying video and audio codecs.
 */
interface EncodeNode extends ASTNode {
    type: 'ENCODE';
    videoCodec: VideoCodec;
    audioCodec: AudioCodec;
}

/** 
 * Represents a bitrate command in the AST.
 */
interface BitrateNode extends ASTNode {
    type: 'BITRATE';
    value: string;
}

/** 
 * Represents an audio command in the AST.
 */
interface AudioNode extends ASTNode {
    type: 'AUDIO';
    value?: string;
    codec?: string;
    bitrate?: string;
    samplerate?: number;
    channels?: AudioChannel;
    normalize?: NormalizeNode;
    eq?: EQNode;
    compress?: CompressionNode;
    reverb?: Reverb;
    fadein?: string;
    fadeout?: string;
}

/** 
 * Represents a watermark command in the AST.
 */
interface WatermarkNode extends ASTNode {
    type: 'WATERMARK';
    file: string;
    position: WatermarkPosition;
}

/**
 * Represents a thumbnail command in the AST.
 */
interface ThumbnailNode extends ASTNode {
    type: 'THUMBNAIL';
    value: string;
}

/**
 * Represents a profile command in the AST.
 * Profiles allow users to define reusable configurations that can be applied to multiple outputs.
 */
interface ProfileNode extends ASTNode {
    type: 'PROFILE';
    name: string;
    body: Partial<Pick<Program, 'resize' | 'fps' | 'encode' | 'bitrate' | 'audio' | 'watermark' | 'thumbnail'>>;
}

/**
 * Represents a normalize command in the AST.
 * Normalization adjusts the audio levels of the output to a specified target.
 */
interface NormalizeNode extends ASTNode {
    type: 'NORMALIZE';
    value: number;
    unit: NormalizeUnit;
}

/**
 * Represents an equalizer command in the AST.
 * The equalizer allows users to adjust the bass, mid, and treble frequencies of the audio.
 */
interface EQNode extends ASTNode {
    type: 'EQ';
    bass?: number;
    mid?: number;
    treble?: number;
}

/**
 * Represents a compression command in the AST.
 * Compression reduces the dynamic range of the audio, making quiet sounds louder and loud sounds quieter.
 */
interface CompressionNode extends ASTNode {
    type: 'COMPRESSION';
    threshold?: number;
    ratio?: number;
    attack?: number;
    release?: number;
}


/**
 * The root Program node represents the fully parsed script.
 * It contains mandatory inputs/outputs, optional configurations, 
 * and any reusable profiles defined in the script.
 */
export interface Program extends ASTNode {
    input: InputNode;
    outputs: OutputBlockNode[];
    resize?: ResizeNode;
    fps?: FpsNode;
    encode?: EncodeNode;
    bitrate?: BitrateNode;
    audio?: AudioNode;
    watermark?: WatermarkNode;
    thumbnail?: ThumbnailNode;
    profiles: Record<string, ProfileNode>;
}
