import { describe, it, expect } from 'vitest';
import { analyze } from '../src/analyzer.js';
import { ProgramV2 } from '../src/interfaces/v2.js';

describe('Analyzer V2 Tests', () => {
    const createBaseV2Program = (overrides?: Partial<ProgramV2>): ProgramV2 => {
        return {
            type: 'PROGRAM',
            version: 2,
            line: 1,
            column: 1,
            length: 0,
            sources: {
                intro: { type: 'SOURCE', name: 'intro', file: 'intro.mp4', line: 2, column: 1, length: 10 }
            },
            clips: {},
            mixes: {},
            timeline: null,
            outputs: [{ type: 'OUTPUT_BLOCK', file: 'out.mp4', overrides: {}, line: 3, column: 1, length: 10 }],
            profiles: {},
            ...overrides
        } as ProgramV2;
    };

    it('should pass on valid V2 program', () => {
        const prog = createBaseV2Program();
        expect(() => analyze(prog)).not.toThrow();
    });

    it('should throw if no sources are declared', () => {
        const prog = createBaseV2Program({ sources: {} });
        expect(() => analyze(prog)).toThrow('At least one source is required.');
    });

    it('should throw if no outputs are declared', () => {
        const prog = createBaseV2Program({ outputs: [] });
        expect(() => analyze(prog)).toThrow('Output file is missing.');
    });

    it('should throw if clips are defined but timeline is missing', () => {
        const prog = createBaseV2Program({
            clips: {
                c1: { type: 'CLIP', name: 'c1', sourceName: 'intro', start: '0s', end: '10s', line: 1, column: 1, length: 0 }
            },
            timeline: null
        });
        expect(() => analyze(prog)).toThrow('Timeline is required when clips are defined.');
    });

    it('should throw if source format is unsupported', () => {
        const prog = createBaseV2Program({
            sources: {
                doc: { type: 'SOURCE', name: 'doc', file: 'document.txt', line: 1, column: 1, length: 0 }
            }
        });
        expect(() => analyze(prog)).toThrow('Unsupported source format: .txt');
    });

    it('should throw if clip references unknown source', () => {
        const prog = createBaseV2Program({
            clips: {
                c1: { type: 'CLIP', name: 'c1', sourceName: 'unknown', start: '0s', end: '10s', line: 1, column: 1, length: 0 }
            },
            timeline: { type: 'TIMELINE', clips: ['c1'], line: 1, column: 1, length: 0 }
        });
        expect(() => analyze(prog)).toThrow('Clip "c1" references unknown source "unknown"');
    });

    it('should throw if clip references itself as a source (circular reference)', () => {
        const prog = createBaseV2Program({
            sources: {
                c1: { type: 'SOURCE', name: 'c1', file: 'intro.mp4', line: 1, column: 1, length: 0 }
            },
            clips: {
                c1: { type: 'CLIP', name: 'c1', sourceName: 'c1', start: '0s', end: '10s', line: 1, column: 1, length: 0 }
            },
            timeline: { type: 'TIMELINE', clips: ['c1'], line: 1, column: 1, length: 0 }
        });
        expect(() => analyze(prog)).toThrow('Clip "c1" cannot reference itself as a source');
    });

    it('should throw if clip start is >= end', () => {
        const prog = createBaseV2Program({
            clips: {
                c1: { type: 'CLIP', name: 'c1', sourceName: 'intro', start: '10s', end: '5s', line: 1, column: 1, length: 0 }
            },
            timeline: { type: 'TIMELINE', clips: ['c1'], line: 1, column: 1, length: 0 }
        });
        expect(() => analyze(prog)).toThrow('Clip "c1" start must be less than end');
    });

    it('should throw if mix track references unknown source', () => {
        const prog = createBaseV2Program({
            mixes: {
                bg: {
                    type: 'MIX',
                    name: 'bg',
                    tracks: [{ type: 'TRACK', sourceName: 'unknown', volume: 0.5, line: 1, column: 1, length: 0 }],
                    line: 1, column: 1, length: 0
                }
            }
        });
        expect(() => analyze(prog)).toThrow('Track in mix "bg" references unknown source "unknown"');
    });

    it('should throw if timeline references unknown clip', () => {
        const prog = createBaseV2Program({
            timeline: { type: 'TIMELINE', clips: ['unknown'], line: 1, column: 1, length: 0 }
        });
        expect(() => analyze(prog)).toThrow('Timeline references unknown clip "unknown"');
    });

    it('should throw if audio mix reference not found', () => {
        const prog = createBaseV2Program({
            audio: { type: 'AUDIO', value: 'missing_mix', line: 1, column: 1, length: 0 }
        });
        expect(() => analyze(prog)).toThrow('Audio mix "missing_mix" not found');
    });
});
