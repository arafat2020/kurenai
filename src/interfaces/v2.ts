import {
    ASTNode,
    EncodeNode,
    BitrateNode,
    AudioNode,
    WatermarkNode,
    ThumbnailNode,
    OutputBlockNode,
    ProfileNode,
    ResizeNode,
    FpsNode
} from "./parser.js";

/**
 * Represents a named input source file in V2.
 */
export interface SourceNode extends ASTNode {
    type: 'SOURCE';
    name: string;
    file: string;
}

/**
 * Represents a clip (time cut) defined from a source in V2.
 */
export interface ClipNode extends ASTNode {
    type: 'CLIP';
    name: string;
    sourceName: string;
    start: string;
    end: string;
}

/**
 * Represents a single audio track configuration inside a mix block in V2.
 */
export interface TrackNode extends ASTNode {
    type: 'TRACK';
    sourceName: string;
    volume: number;
}

/**
 * Represents an audio mix block containing multiple tracks in V2.
 */
export interface MixNode extends ASTNode {
    type: 'MIX';
    name: string;
    tracks: TrackNode[];
}

/**
 * Represents the ordered sequence of clips in V2.
 */
export interface TimelineNode extends ASTNode {
    type: 'TIMELINE';
    clips: string[];
}

/**
 * The root AST node for V2 scripts.
 */
export interface ProgramV2 extends ASTNode {
    version: 2;
    sources: Record<string, SourceNode>;
    clips: Record<string, ClipNode>;
    mixes: Record<string, MixNode>;
    timeline: TimelineNode | null;

    // V1 fields carried over
    encode?: EncodeNode;
    bitrate?: BitrateNode;
    audio?: AudioNode;
    watermark?: WatermarkNode;
    thumbnail?: ThumbnailNode;
    resize?: ResizeNode;
    fps?: FpsNode;
    outputs: OutputBlockNode[];
    profiles: Record<string, ProfileNode>;
}
