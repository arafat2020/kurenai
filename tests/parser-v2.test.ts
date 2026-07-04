import { describe, it, expect } from 'vitest';
import { lexer } from '../src/lexer.js';
import { parseTokens } from '../src/parser.js';
import { ProgramV2 } from '../src/interfaces/v2.js';

describe('Parser V2 Tests', () => {
    it('should parse use v2, sources and clips', () => {
        const script = `use v2
source intro "intro.mp4"
clip c_intro from intro 0s to 10s
output "final.mp4"`;
        const tokens = lexer(script);
        const ast = parseTokens(tokens) as ProgramV2;

        expect(ast.version).toBe(2);
        expect(ast.sources['intro']).toEqual({
            type: 'SOURCE',
            name: 'intro',
            file: 'intro.mp4',
            line: 2,
            column: 1,
            length: 24
        });
        expect(ast.clips['c_intro']).toEqual({
            type: 'CLIP',
            name: 'c_intro',
            sourceName: 'intro',
            start: '0s',
            end: '10s',
            line: 3,
            column: 1,
            length: 33
        });
    });

    it('should parse mix block and track items with floats', () => {
        const script = `use v2
mix bg {
  track music volume 0.3
  track voice volume 1.0
}
output "final.mp4"`;
        const tokens = lexer(script);
        const ast = parseTokens(tokens) as ProgramV2;

        expect(ast.mixes['bg']).toBeDefined();
        expect(ast.mixes['bg']!.tracks.length).toBe(2);
        expect(ast.mixes['bg']!.tracks[0]).toEqual({
            type: 'TRACK',
            sourceName: 'music',
            volume: 0.3,
            line: 3,
            column: 3,
            length: 22
        });
    });

    it('should parse timeline arranged clips', () => {
        const script = `use v2
timeline {
  c_intro
  c_main
}
output "final.mp4"`;
        const tokens = lexer(script);
        const ast = parseTokens(tokens) as ProgramV2;

        expect(ast.timeline).toEqual({
            type: 'TIMELINE',
            clips: ['c_intro', 'c_main'],
            line: 2,
            column: 1,
            length: 1
        });
    });
});
