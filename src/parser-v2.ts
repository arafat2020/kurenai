import { type Token } from './lexer.js';
import { CompilerError } from './errors.js';
import { type ProgramV2, type MixNode } from './interfaces/v2.js';
import { type ParseCommandFn } from './core/BaseParser.js';
import { OutputParser }   from './core/OutputParser.js';
import { EncodeParser }   from './core/EncodeParser.js';
import { BitrateParser }  from './core/BitrateParser.js';
import { AudioParser }    from './core/AudioParser.js';
import { WatermarkParser } from './core/WatermarkParser.js';
import { ThumbnailParser } from './core/ThumbnailParser.js';
import { ProfileParser }  from './core/ProfileParser.js';
import { UseParser }      from './core/UseParser.js';
import { ResizeParser }   from './core/ResizeParser.js';
import { FpsParser }      from './core/FpsParser.js';

/**
 * Stateful parser that converts a flat token array into a ProgramV2 AST.
 */
class ParserV2 {
    private readonly program: Partial<ProgramV2>;

    constructor(private readonly tokens: Token[]) {
        this.program = {
            type: 'PROGRAM',
            line: tokens[0]?.line ?? 1,
            column: tokens[0]?.column ?? 1,
            length: tokens[0]?.length ?? 0,
            version: 2,
            sources: {},
            clips: {},
            mixes: {},
            timeline: null,
            profiles: {},
            outputs: [],
        };
    }

    /**
     * Dispatches a single keyword to the matching V2 parser or existing V1 parser.
     */
    private parseCommand(keyword: string, i: number, target: any): number {
        const { tokens, program } = this;
        const dispatch: ParseCommandFn = this.parseCommand.bind(this);
        const token = tokens[i]!;

        switch (keyword) {
            case 'source': {
                const nameToken = tokens[i + 1];
                const fileToken = tokens[i + 2];
                if (!nameToken || nameToken.type !== 'IDENTIFIER') {
                    throw new CompilerError('Source name required', token.line, token.column, token.length);
                }
                if (!fileToken || fileToken.type !== 'STRING') {
                    throw new CompilerError('Source file path required', token.line, token.column, token.length);
                }
                if (!program.sources) program.sources = {};
                program.sources[nameToken.value] = {
                    type: 'SOURCE',
                    name: nameToken.value,
                    file: fileToken.value.replace(/"/g, ''),
                    line: token.line,
                    column: token.column,
                    length: (fileToken.column + fileToken.length) - token.column,
                };
                return i + 2;
            }
            case 'clip': {
                const nameToken = tokens[i + 1];
                const fromToken = tokens[i + 2];
                const sourceToken = tokens[i + 3];
                const startToken = tokens[i + 4];
                const toToken = tokens[i + 5];
                const endToken = tokens[i + 6];

                if (!nameToken || nameToken.type !== 'IDENTIFIER') {
                    throw new CompilerError('Clip name required', token.line, token.column, token.length);
                }
                if (!fromToken || fromToken.type !== 'KEYWORD' || fromToken.value !== 'from') {
                    throw new CompilerError("Expected 'from' keyword", token.line, token.column, token.length);
                }
                if (!sourceToken || sourceToken.type !== 'IDENTIFIER') {
                    throw new CompilerError('Source name required', token.line, token.column, token.length);
                }
                if (!startToken || startToken.type !== 'TIME') {
                    throw new CompilerError('Start time required', token.line, token.column, token.length);
                }
                if (!toToken || toToken.type !== 'KEYWORD' || toToken.value !== 'to') {
                    throw new CompilerError("Expected 'to' keyword", token.line, token.column, token.length);
                }
                if (!endToken || endToken.type !== 'TIME') {
                    throw new CompilerError('End time required', token.line, token.column, token.length);
                }

                if (!program.clips) program.clips = {};
                program.clips[nameToken.value] = {
                    type: 'CLIP',
                    name: nameToken.value,
                    sourceName: sourceToken.value,
                    start: startToken.value,
                    end: endToken.value,
                    line: token.line,
                    column: token.column,
                    length: (endToken.column + endToken.length) - token.column,
                };
                return i + 6;
            }
            case 'mix': {
                const nameToken = tokens[i + 1];
                const lbraceToken = tokens[i + 2];
                if (!nameToken || nameToken.type !== 'IDENTIFIER') {
                    throw new CompilerError('Mix name required', token.line, token.column, token.length);
                }
                if (!lbraceToken || lbraceToken.type !== 'LBRACE') {
                    throw new CompilerError("Expected '{' at the start of mix block", token.line, token.column, token.length);
                }
                const mixNode: MixNode = {
                    type: 'MIX',
                    name: nameToken.value,
                    tracks: [],
                    line: token.line,
                    column: token.column,
                    length: 0,
                };
                let j = i + 3;
                let endToken = lbraceToken;
                while (j < tokens.length) {
                    const inner = tokens[j];
                    if (!inner) {
                        throw new CompilerError('Unexpected end of file inside mix block', lbraceToken.line, lbraceToken.column, lbraceToken.length);
                    }
                    if (inner.type === 'RBRACE') {
                        endToken = inner;
                        break;
                    }
                    if (inner.type !== 'KEYWORD' || inner.value !== 'track') {
                        throw new CompilerError("Expected 'track' keyword", inner.line, inner.column, inner.length);
                    }
                    const sourceToken = tokens[j + 1];
                    const volKeyToken = tokens[j + 2];
                    const volValToken = tokens[j + 3];

                    if (!sourceToken || sourceToken.type !== 'IDENTIFIER') {
                        throw new CompilerError('Track source name required', inner.line, inner.column, inner.length);
                    }
                    if (!volKeyToken || volKeyToken.type !== 'KEYWORD' || volKeyToken.value !== 'volume') {
                        throw new CompilerError("Expected 'volume' keyword", inner.line, inner.column, inner.length);
                    }
                    if (!volValToken || volValToken.type !== 'FLOAT') {
                        throw new CompilerError('Expected float volume value', inner.line, inner.column, inner.length);
                    }

                    mixNode.tracks.push({
                        type: 'TRACK',
                        sourceName: sourceToken.value,
                        volume: parseFloat(volValToken.value),
                        line: inner.line,
                        column: inner.column,
                        length: (volValToken.column + volValToken.length) - inner.column,
                    });
                    j += 4;
                }
                if (j >= tokens.length) {
                    throw new CompilerError("Expected '}' at the end of mix block", lbraceToken.line, lbraceToken.column, lbraceToken.length);
                }
                mixNode.length = (endToken.column + endToken.length) - token.column;
                if (!program.mixes) program.mixes = {};
                program.mixes[nameToken.value] = mixNode;
                return j;
            }
            case 'timeline': {
                const lbraceToken = tokens[i + 1];
                if (!lbraceToken || lbraceToken.type !== 'LBRACE') {
                    throw new CompilerError("Expected '{' at the start of timeline block", token.line, token.column, token.length);
                }
                const clips: string[] = [];
                let j = i + 2;
                let endToken = lbraceToken;
                while (j < tokens.length) {
                    const inner = tokens[j];
                    if (!inner) {
                        throw new CompilerError('Unexpected end of file inside timeline block', lbraceToken.line, lbraceToken.column, lbraceToken.length);
                    }
                    if (inner.type === 'RBRACE') {
                        endToken = inner;
                        break;
                    }
                    if (inner.type !== 'IDENTIFIER') {
                        throw new CompilerError(`Expected clip name, got "${inner.value}"`, inner.line, inner.column, inner.length);
                    }
                    clips.push(inner.value);
                    j++;
                }
                if (j >= tokens.length) {
                    throw new CompilerError("Expected '}' at the end of timeline block", lbraceToken.line, lbraceToken.column, lbraceToken.length);
                }
                program.timeline = {
                    type: 'TIMELINE',
                    clips,
                    line: token.line,
                    column: token.column,
                    length: (endToken.column + endToken.length) - token.column,
                };
                return j;
            }
            case 'encode':    return new EncodeParser(tokens, program as any).parse(i, target);
            case 'bitrate':   return new BitrateParser(tokens, program as any).parse(i, target);
            case 'audio':     return new AudioParser(tokens, program as any).parse(i, target);
            case 'watermark': return new WatermarkParser(tokens, program as any).parse(i, target);
            case 'thumbnail': return new ThumbnailParser(tokens, program as any).parse(i, target);
            case 'output':    return new OutputParser(tokens, program as any, dispatch).parse(i, target);
            case 'profile':   return new ProfileParser(tokens, program as any, dispatch).parse(i, target);
            case 'use':       return new UseParser(tokens, program as any).parse(i, target);
            case 'resize':    return new ResizeParser(tokens, program as any).parse(i, target);
            case 'fps':       return new FpsParser(tokens, program as any).parse(i, target);
            default:
                throw new CompilerError(`Unknown keyword: ${keyword}`, token.line, token.column, token.length);
        }
    }

    parse(): ProgramV2 {
        let i = 0;
        while (i < this.tokens.length) {
            const token = this.tokens[i];
            if (!token) break;

            if (token.type === 'KEYWORD') {
                i = this.parseCommand(token.value, i, this.program);
            } else {
                throw new CompilerError(`Unexpected token "${token.value}"`, token.line, token.column, token.length);
            }
            i++;
        }
        return this.program as ProgramV2;
    }
}

export const parseTokensV2 = (tokens: Token[]): ProgramV2 => new ParserV2(tokens).parse();
