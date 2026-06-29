import { ASTNode, AudioNode } from "../interfaces/parser.js";

// A dedicated builder type for constructing the AudioNode incrementally
// 1. Isolate just the audio-specific properties
type AudioKeys = Omit<AudioNode, 'type' | 'line' | 'column' | 'length'>;

// 2. Make every audio property explicitly writable and defined (but allowing string | number | undefined)
type WritableAudioProperties = {
    [K in keyof AudioKeys]-?: AudioKeys[K] | undefined;
};

// 3. Combine them back with the mandatory AST tracking headers
export type AudioNodeBuilder = WritableAudioProperties & Pick<ASTNode, 'type' | 'line' | 'column' | 'length'>;