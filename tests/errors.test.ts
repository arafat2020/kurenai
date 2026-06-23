import { describe, it, expect } from 'vitest';
import { lexer } from '../src/lexer.js';
import { parseTokens } from '../src/parser.js';
import { analyze } from '../src/analyzer.js';
import { CompilerError } from '../src/errors.js';
import { Program, VideoCodec, AudioCodec, WatermarkPosition } from '../src/parser.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Runs the full pipeline (lexer → parser) and asserts a CompilerError is thrown.
 * Returns the caught error so callers can inspect it further.
 */
function expectCompilerError(source: string): CompilerError {
    const tokens = lexer(source);
    let caught: unknown;
    try {
        parseTokens(tokens);
    } catch (err) {
        caught = err;
    }
    expect(caught).toBeInstanceOf(CompilerError);
    return caught as CompilerError;
}

/**
 * Runs lexer → parser → analyzer and asserts a CompilerError is thrown.
 */
function expectAnalyzerError(source: string): CompilerError {
    const tokens = lexer(source);
    const ast = parseTokens(tokens);
    let caught: unknown;
    try {
        analyze(ast);
    } catch (err) {
        caught = err;
    }
    expect(caught).toBeInstanceOf(CompilerError);
    return caught as CompilerError;
}

// ─── Lexer Error Tests ───────────────────────────────────────────────────────

describe('Error Handling — Lexer', () => {
    it('throws CompilerError for an unknown token', () => {
        // "99x" is not a valid resolution (missing height), identifier, or anything else
        expect(() => lexer('resize 99x')).toThrow(CompilerError);
    });

    it('reports the correct line for a lexer error', () => {
        // Error is on line 2
        let caught: unknown;
        try {
            lexer('input "video.mp4"\nresize 99x');
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(CompilerError);
        expect((caught as CompilerError).line).toBe(2);
    });

    it('reports the correct column for a lexer error', () => {
        //  "resize 99x"  — '99x' starts at column 8
        let caught: unknown;
        try {
            lexer('resize 99x');
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(CompilerError);
        expect((caught as CompilerError).column).toBe(8);
    });

    it('reports the correct length for a lexer error', () => {
        // '99x' has length 3
        let caught: unknown;
        try {
            lexer('resize 99x');
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(CompilerError);
        expect((caught as CompilerError).length).toBe(3);
    });

    it('reports the correct column when the bad token is indented', () => {
        // Two leading spaces: "  resize 99x" — '99x' is at column 10
        let caught: unknown;
        try {
            lexer('  resize 99x');
        } catch (err) {
            caught = err;
        }
        expect(caught).toBeInstanceOf(CompilerError);
        expect((caught as CompilerError).column).toBe(10);
    });
});

// ─── Parser Error Tests ──────────────────────────────────────────────────────

describe('Error Handling — Parser', () => {
    describe('input command', () => {
        it('throws CompilerError when input value is missing', () => {
            const err = expectCompilerError('input');
            expect(err.message).toMatch(/File source is required/);
        });

        it('throws CompilerError when input value is not a string', () => {
            // 'output' is a KEYWORD, not a STRING
            const err = expectCompilerError('input output');
            expect(err.message).toMatch(/File source is required/);
        });

        it('points to the bad token column', () => {
            // "input output" — 'output' is at column 7
            const err = expectCompilerError('input output');
            expect(err.column).toBe(7);
        });
    });

    describe('resize command', () => {
        it('throws CompilerError for a non-resolution value', () => {
            // 'invalid' is an IDENTIFIER, not a RESOLUTION
            const err = expectCompilerError('resize invalid');
            expect(err.message).toMatch(/Resolution/);
        });

        it('reports correct line for resize error on line 2', () => {
            const err = expectCompilerError('input "v.mp4"\nresize invalid');
            expect(err.line).toBe(2);
        });

        it('reports correct column for resize error', () => {
            // "resize invalid" — 'invalid' starts at column 8
            const err = expectCompilerError('resize invalid');
            expect(err.column).toBe(8);
        });

        it('reports correct length for resize error', () => {
            // 'invalid' has 7 characters
            const err = expectCompilerError('resize invalid');
            expect(err.length).toBe(7);
        });

        it('throws CompilerError when resize value is missing', () => {
            const err = expectCompilerError('resize');
            expect(err.message).toMatch(/Resize value is required/);
        });
    });

    describe('fps command', () => {
        it('throws CompilerError when fps value is missing', () => {
            const err = expectCompilerError('fps');
            expect(err.message).toMatch(/FPS value is required/);
        });

        it('throws CompilerError when fps value is not a number', () => {
            // 'high' is an IDENTIFIER, not a NUMBER
            const err = expectCompilerError('fps high');
            expect(err.message).toMatch(/FPS value must be a number/);
        });

        it('points to the bad token for fps error', () => {
            // "fps high" — 'high' starts at column 5
            const err = expectCompilerError('fps high');
            expect(err.column).toBe(5);
            expect(err.length).toBe(4);
        });
    });

    describe('output command', () => {
        it('throws CompilerError when output is not a string', () => {
            const err = expectCompilerError('input "v.mp4"\noutput 1920x1080');
            expect(err.message).toMatch(/Value must be a valid source/);
        });

        it('reports correct line for output error', () => {
            const err = expectCompilerError('input "v.mp4"\noutput 1920x1080');
            expect(err.line).toBe(2);
        });

        it('reports correct column for output error', () => {
            // "output 1920x1080" — '1920x1080' starts at column 8
            const err = expectCompilerError('input "v.mp4"\noutput 1920x1080');
            expect(err.column).toBe(8);
        });
    });

    describe('bitrate command', () => {
        it('throws CompilerError when bitrate has no unit', () => {
            // '500' is a NUMBER, not a BITRATE
            const err = expectCompilerError('bitrate 500');
            expect(err.message).toMatch(/Bitrate/);
        });

        it('reports correct column for bitrate error', () => {
            // "bitrate 500" — '500' starts at column 9
            const err = expectCompilerError('bitrate 500');
            expect(err.column).toBe(9);
            expect(err.length).toBe(3);
        });
    });

    describe('encode command', () => {
        it('throws CompilerError when codecs are missing', () => {
            const err = expectCompilerError('encode');
            expect(err.message).toMatch(/Both video and audio codecs are required/);
        });
    });

    describe('watermark command', () => {
        it('throws CompilerError when watermark args are missing', () => {
            const err = expectCompilerError('watermark');
            expect(err.message).toMatch(/Both watermark file and position are required/);
        });
    });

    describe('thumbnail command', () => {
        it('throws CompilerError when thumbnail value is not a time', () => {
            // '10' is a NUMBER, not a TIME ('10s')
            const err = expectCompilerError('thumbnail 10');
            expect(err.message).toMatch(/Thumbnail value must be a time/);
        });

        it('reports correct column for thumbnail error', () => {
            // "thumbnail 10" — '10' starts at column 11
            const err = expectCompilerError('thumbnail 10');
            expect(err.column).toBe(11);
            expect(err.length).toBe(2);
        });
    });

    describe('profile command', () => {
        it('throws CompilerError when profile name is missing', () => {
            const err = expectCompilerError('profile');
            expect(err.message).toMatch(/Profile name is required/);
        });

        it('throws CompilerError when profile block is missing opening brace', () => {
            const err = expectCompilerError('profile myProfile fps');
            expect(err.message).toMatch(/Expected \{/);
        });

        it('throws CompilerError when profile block is unclosed', () => {
            const err = expectCompilerError('profile myProfile { fps 30');
            expect(err.message).toMatch(/Expected \}/);
        });
    });

    describe('use command', () => {
        it('throws CompilerError when the referenced profile does not exist', () => {
            const err = expectCompilerError('use ghost');
            expect(err.message).toMatch(/not found/);
        });

        it('points to the unknown profile name token', () => {
            // "use ghost" — 'ghost' starts at column 5
            const err = expectCompilerError('use ghost');
            expect(err.column).toBe(5);
            expect(err.length).toBe(5);
        });
    });

    describe('unexpected top-level token', () => {
        it('throws CompilerError for an unexpected token at the top level', () => {
            // '1920x1080' is a RESOLUTION, not a KEYWORD
            const err = expectCompilerError('1920x1080');
            expect(err.message).toMatch(/Unexpected token/);
        });

        it('reports the correct position for the unexpected token', () => {
            const err = expectCompilerError('1920x1080');
            expect(err.line).toBe(1);
            expect(err.column).toBe(1);
            expect(err.length).toBe(9);
        });
    });
});

// ─── Analyzer Error Tests ────────────────────────────────────────────────────

describe('Error Handling — Analyzer', () => {
    const makeProgram = (overrides?: Partial<Program>): Program => ({
        type: 'PROGRAM',
        line: 1,
        column: 1,
        length: 0,
        profiles: {},
        input:  { type: 'INPUT',  value: 'video.mp4', line: 1, column: 7,  length: 10 },
        outputs: [{ type: 'OUTPUT_BLOCK', file: 'out.mp4', overrides: {},   line: 2, column: 8,  length: 8  }],
        ...overrides,
    } as Program);

    describe('input validation', () => {
        it('throws CompilerError for unsupported input format', () => {
            const prog = makeProgram({
                input: { type: 'INPUT', value: 'song.mp3', line: 1, column: 7, length: 9 },
            });
            let caught: unknown;
            try { analyze(prog); } catch (e) { caught = e; }
            expect(caught).toBeInstanceOf(CompilerError);
            expect((caught as CompilerError).message).toMatch(/Unsupported input format/);
        });

        it('points to the input token position', () => {
            const prog = makeProgram({
                input: { type: 'INPUT', value: 'song.mp3', line: 1, column: 7, length: 9 },
            });
            let caught: unknown;
            try { analyze(prog); } catch (e) { caught = e; }
            const err = caught as CompilerError;
            expect(err.line).toBe(1);
            expect(err.column).toBe(7);
            expect(err.length).toBe(9);
        });
    });

    describe('output validation', () => {
        it('throws CompilerError for unsupported output format', () => {
            const prog = makeProgram({
                outputs: [{ type: 'OUTPUT_BLOCK', file: 'out.wav', overrides: {}, line: 2, column: 8, length: 8 }],
            });
            let caught: unknown;
            try { analyze(prog); } catch (e) { caught = e; }
            expect(caught).toBeInstanceOf(CompilerError);
            expect((caught as CompilerError).message).toMatch(/Unsupported output format/);
            expect((caught as CompilerError).line).toBe(2);
        });
    });

    describe('fps validation', () => {
        it('throws CompilerError for fps = 0 and points to the value token', () => {
            const prog = makeProgram({
                fps: { type: 'FPS', value: 0, line: 3, column: 5, length: 1 },
            });
            let caught: unknown;
            try { analyze(prog); } catch (e) { caught = e; }
            const err = caught as CompilerError;
            expect(err).toBeInstanceOf(CompilerError);
            expect(err.message).toMatch(/Invalid FPS value/);
            expect(err.line).toBe(3);
            expect(err.column).toBe(5);
        });

        it('throws CompilerError for fps > 240', () => {
            const prog = makeProgram({
                fps: { type: 'FPS', value: 999, line: 3, column: 5, length: 3 },
            });
            let caught: unknown;
            try { analyze(prog); } catch (e) { caught = e; }
            expect(caught).toBeInstanceOf(CompilerError);
            expect((caught as CompilerError).message).toMatch(/Invalid FPS value/);
        });
    });

    describe('resize validation', () => {
        it('throws CompilerError for odd dimensions and points to the resize token', () => {
            const prog = makeProgram({
                resize: { type: 'RESIZE', width: 1921, height: 1080, line: 2, column: 8, length: 9 },
            });
            let caught: unknown;
            try { analyze(prog); } catch (e) { caught = e; }
            const err = caught as CompilerError;
            expect(err).toBeInstanceOf(CompilerError);
            expect(err.message).toMatch(/divisible by 2/);
            expect(err.line).toBe(2);
            expect(err.column).toBe(8);
            expect(err.length).toBe(9);
        });

        it('throws CompilerError for zero dimensions', () => {
            const prog = makeProgram({
                resize: { type: 'RESIZE', width: 0, height: 720, line: 2, column: 8, length: 5 },
            });
            let caught: unknown;
            try { analyze(prog); } catch (e) { caught = e; }
            expect(caught).toBeInstanceOf(CompilerError);
            expect((caught as CompilerError).message).toMatch(/greater than 0/);
        });
    });

    describe('encode validation', () => {
        it('throws CompilerError for an unsupported video codec', () => {
            const prog = makeProgram({
                encode: { type: 'ENCODE', videoCodec: 'wmv' as VideoCodec, audioCodec: AudioCodec.AAC, line: 3, column: 1, length: 10 },
            });
            let caught: unknown;
            try { analyze(prog); } catch (e) { caught = e; }
            const err = caught as CompilerError;
            expect(err).toBeInstanceOf(CompilerError);
            expect(err.message).toMatch(/Unsupported video codec/);
            expect(err.line).toBe(3);
        });

        it('throws CompilerError for an unsupported audio codec', () => {
            const prog = makeProgram({
                encode: { type: 'ENCODE', videoCodec: VideoCodec.H264, audioCodec: 'wav' as AudioCodec, line: 3, column: 1, length: 12 },
            });
            let caught: unknown;
            try { analyze(prog); } catch (e) { caught = e; }
            expect(caught).toBeInstanceOf(CompilerError);
            expect((caught as CompilerError).message).toMatch(/Unsupported audio codec/);
        });
    });

    describe('watermark validation', () => {
        it('throws CompilerError for an invalid watermark position', () => {
            const prog = makeProgram({
                watermark: { type: 'WATERMARK', file: 'logo.png', position: 'middle' as WatermarkPosition, line: 4, column: 1, length: 24 },
            });
            let caught: unknown;
            try { analyze(prog); } catch (e) { caught = e; }
            const err = caught as CompilerError;
            expect(err).toBeInstanceOf(CompilerError);
            expect(err.message).toMatch(/Unsupported watermark position/);
            expect(err.line).toBe(4);
        });

        it('throws CompilerError for an empty watermark file path', () => {
            const prog = makeProgram({
                watermark: { type: 'WATERMARK', file: '', position: WatermarkPosition.TOP_LEFT, line: 4, column: 1, length: 20 },
            });
            let caught: unknown;
            try { analyze(prog); } catch (e) { caught = e; }
            expect(caught).toBeInstanceOf(CompilerError);
            expect((caught as CompilerError).message).toMatch(/Watermark file path cannot be empty/);
        });
    });

    describe('end-to-end: pipeline error from source text', () => {
        it('CompilerError from a full source string has the right 3-part metadata', () => {
            // Line 2 has an invalid resize value — 'invalid' is at col 8, length 7
            const source = 'input "video.mp4"\nresize invalid\noutput "out.mp4"';
            const err = expectCompilerError(source);
            expect(err.line).toBe(2);
            expect(err.column).toBe(8);
            expect(err.length).toBe(7);
            expect(err.message).toMatch(/Resolution/);
        });

        it('CompilerError for bad output value points to the offending token', () => {
            const source = 'input "video.mp4"\noutput 1920x1080';
            const err = expectCompilerError(source);
            expect(err.line).toBe(2);
            expect(err.column).toBe(8);   // '1920x1080' starts at col 8
            expect(err.length).toBe(9);   // '1920x1080' is 9 chars
        });
    });
});
