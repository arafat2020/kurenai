import { type Token } from '../lexer.js';
import { CompilerError } from '../errors.js';
import { NormalizeUnit, Reverb, AudioChannel } from '../enums/parser.js';
import { type Program, type NormalizeNode, type EQNode, type CompressionNode } from '../interfaces/parser.js';
import { type AudioNodeBuilder } from '../types/parser.js';
import { BaseParser } from './BaseParser.js';

/**
 * Parses: `audio "file.mp3"` (flat form) or `audio { ...properties }` (block form).
 *
 * The block form supports: file, codec, bitrate, samplerate, channels, reverb,
 * fadein, fadeout, normalize, eq { ... }, and compress { ... }.
 * Inner eq and compress sub-blocks are handled by private methods.
 */
export class AudioParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const nextAudioToken = this.tokens[i + 1];

        if (nextAudioToken === undefined) {
            throw new CompilerError('Audio value is required', token.line, token.column, token.length);
        }

        // ── Block form: audio { ... } ────────────────────────────────────────
        if (nextAudioToken.type === 'LBRACE') {
            return this.parseAudioBlock(i, target, token, nextAudioToken);
        }

        // ── Flat form: audio "file.mp3" ──────────────────────────────────────
        if (nextAudioToken.type !== 'IDENTIFIER' && nextAudioToken.type !== 'STRING') {
            throw new CompilerError("Audio value must be a string with the audio file path, e.g. 'audio.mp3'", nextAudioToken.line, nextAudioToken.column, nextAudioToken.length);
        }
        target.audio = {
            type: 'AUDIO',
            value: nextAudioToken.value.replace(/"/g, ''),
            line: nextAudioToken.line,
            column: nextAudioToken.column,
            length: nextAudioToken.length,
        };
        return i + 1;
    }

    // ── Private helpers ──────────────────────────────────────────────────────

    private parseAudioBlock(
        i: number,
        target: Partial<Program>,
        keywordToken: Token,
        lbraceToken: Token
    ): number {
        let j = i + 2;
        const audioBody: Partial<AudioNodeBuilder> = {
            type: 'AUDIO',
            line: keywordToken.line,
            column: keywordToken.column,
            length: 0,
        };

        while (j < this.tokens.length) {
            const innerToken = this.tokens[j];
            if (!innerToken) {
                throw new CompilerError('Unexpected end of file inside audio block', lbraceToken.line, lbraceToken.column, lbraceToken.length);
            }
            if (innerToken.type === 'RBRACE') {
                audioBody.length = (innerToken.column + innerToken.length) - keywordToken.column;
                break;
            }
            if (innerToken.type === 'KEYWORD' || innerToken.type === 'IDENTIFIER') {
                const nextInnerToken = this.tokens[j + 1];
                if (!nextInnerToken || nextInnerToken.type === 'RBRACE') {
                    throw new CompilerError(`Value required for audio property "${innerToken.value}"`, innerToken.line, innerToken.column, innerToken.length);
                }

                switch (innerToken.value) {
                    case 'file':
                        if (nextInnerToken.type !== 'STRING' && nextInnerToken.type !== 'IDENTIFIER') {
                            throw new CompilerError('Audio file must be a valid path string', nextInnerToken.line, nextInnerToken.column, nextInnerToken.length);
                        }
                        audioBody.value = nextInnerToken.value.replace(/"/g, '');
                        j += 2;
                        break;

                    case 'codec':
                        if (nextInnerToken.type !== 'IDENTIFIER' && nextInnerToken.type !== 'STRING') {
                            throw new CompilerError('Audio codec must be a valid codec name', nextInnerToken.line, nextInnerToken.column, nextInnerToken.length);
                        }
                        audioBody.codec = nextInnerToken.value.replace(/"/g, '');
                        j += 2;
                        break;

                    case 'bitrate':
                        if (nextInnerToken.type !== 'BITRATE' && nextInnerToken.type !== 'STRING' && nextInnerToken.type !== 'IDENTIFIER' && nextInnerToken.type !== 'NUMBER') {
                            throw new CompilerError('Audio bitrate must be a valid bitrate format or string', nextInnerToken.line, nextInnerToken.column, nextInnerToken.length);
                        }
                        audioBody.bitrate = nextInnerToken.value.replace(/"/g, '');
                        j += 2;
                        break;

                    case 'samplerate':
                        if (nextInnerToken.type !== 'NUMBER') {
                            throw new CompilerError('Audio sample rate must be a number', nextInnerToken.line, nextInnerToken.column, nextInnerToken.length);
                        }
                        audioBody.samplerate = parseInt(nextInnerToken.value);
                        j += 2;
                        break;

                    case 'channels': {
                        if (nextInnerToken.type !== 'IDENTIFIER' && nextInnerToken.type !== 'STRING') {
                            throw new CompilerError("Audio channels must be 'stereo' or 'mono'", nextInnerToken.line, nextInnerToken.column, nextInnerToken.length);
                        }
                        const channelVal = nextInnerToken.value.replace(/"/g, '');
                        if (channelVal !== 'stereo' && channelVal !== 'mono') {
                            throw new CompilerError("Audio channels must be 'stereo' or 'mono'", nextInnerToken.line, nextInnerToken.column, nextInnerToken.length);
                        }
                        audioBody.channels = channelVal as AudioChannel;
                        j += 2;
                        break;
                    }

                    case 'reverb': {
                        if (nextInnerToken.type !== 'IDENTIFIER' && nextInnerToken.type !== 'STRING') {
                            throw new CompilerError('Reverb must be a valid type (subtle, medium, large)', nextInnerToken.line, nextInnerToken.column, nextInnerToken.length);
                        }
                        const reverbVal = nextInnerToken.value.replace(/"/g, '').toLowerCase();
                        if (reverbVal !== 'subtle' && reverbVal !== 'medium' && reverbVal !== 'large') {
                            throw new CompilerError('Unsupported reverb type. Supported: subtle, medium, large', nextInnerToken.line, nextInnerToken.column, nextInnerToken.length);
                        }
                        audioBody.reverb = reverbVal as Reverb;
                        j += 2;
                        break;
                    }

                    case 'fadein':
                    case 'fadeout': {
                        if (nextInnerToken.type !== 'TIME' && nextInnerToken.type !== 'MILLISECOND' && nextInnerToken.type !== 'STRING' && nextInnerToken.type !== 'IDENTIFIER') {
                            throw new CompilerError(`Audio ${innerToken.value} must be a time or millisecond value (e.g. '2s', '500ms')`, nextInnerToken.line, nextInnerToken.column, nextInnerToken.length);
                        }
                        audioBody[innerToken.value as 'fadein' | 'fadeout'] = nextInnerToken.value.replace(/"/g, '');
                        j += 2;
                        break;
                    }

                    case 'normalize': {
                        const valueToken = nextInnerToken;
                        const unitToken = this.tokens[j + 2];
                        if (!valueToken || valueToken.type !== 'NUMBER') {
                            throw new CompilerError('Normalize value must be a number', valueToken?.line ?? innerToken.line, valueToken?.column ?? innerToken.column, valueToken?.length ?? innerToken.length);
                        }
                        if (!unitToken || unitToken.type !== 'IDENTIFIER') {
                            throw new CompilerError('Normalize unit must be a valid unit (lufs, dbtp, dbrms)', unitToken?.line ?? innerToken.line, unitToken?.column ?? innerToken.column, unitToken?.length ?? innerToken.length);
                        }
                        const unitVal = unitToken.value.toLowerCase();
                        if (unitVal !== 'lufs' && unitVal !== 'dbtp' && unitVal !== 'dbrms') {
                            throw new CompilerError('Unsupported normalize unit. Supported: lufs, dbtp, dbrms', unitToken.line, unitToken.column, unitToken.length);
                        }
                        audioBody.normalize = {
                            type: 'NORMALIZE',
                            value: parseInt(valueToken.value),
                            unit: unitVal as NormalizeUnit,
                            line: innerToken.line,
                            column: innerToken.column,
                            length: (unitToken.column + unitToken.length) - innerToken.column,
                        } as NormalizeNode;
                        j += 3;
                        break;
                    }

                    case 'eq': {
                        if (nextInnerToken.type !== 'LBRACE') {
                            throw new CompilerError('Expected { after eq keyword', nextInnerToken.line, nextInnerToken.column, nextInnerToken.length);
                        }
                        const { node: eqNode, endIndex } = this.parseEQBlock(j, innerToken, nextInnerToken);
                        audioBody.eq = eqNode;
                        j = endIndex + 1;
                        break;
                    }

                    case 'compress': {
                        if (nextInnerToken.type !== 'LBRACE') {
                            throw new CompilerError('Expected { after compress keyword', nextInnerToken.line, nextInnerToken.column, nextInnerToken.length);
                        }
                        const { node: compressNode, endIndex } = this.parseCompressBlock(j, innerToken, nextInnerToken);
                        audioBody.compress = compressNode;
                        j = endIndex + 1;
                        break;
                    }

                    default:
                        throw new CompilerError(`Unknown audio property "${innerToken.value}"`, innerToken.line, innerToken.column, innerToken.length);
                }
            } else {
                throw new CompilerError(`Unexpected token "${innerToken.value}" inside audio block`, innerToken.line, innerToken.column, innerToken.length);
            }
        }

        if (j >= this.tokens.length) {
            throw new CompilerError('Expected } at the end of audio block', lbraceToken.line, lbraceToken.column, lbraceToken.length);
        }

        target.audio = audioBody as any;
        return j;
    }

    /**
     * Parses `eq { bass +3db  mid -1db  treble +2db }`.
     * @returns The built EQNode and the index of the closing `}`.
     */
    private parseEQBlock(
        j: number,
        keywordToken: Token,
        lbraceToken: Token
    ): { node: EQNode; endIndex: number } {
        let k = j + 2;
        const eqNode: EQNode = {
            type: 'EQ',
            line: keywordToken.line,
            column: keywordToken.column,
            length: 0,
        };
        let closed = false;

        while (k < this.tokens.length) {
            const eqToken = this.tokens[k];
            if (!eqToken) {
                throw new CompilerError('Unexpected end of file inside eq block', lbraceToken.line, lbraceToken.column, lbraceToken.length);
            }
            if (eqToken.type === 'RBRACE') {
                eqNode.length = (eqToken.column + eqToken.length) - keywordToken.column;
                closed = true;
                break;
            }
            if (eqToken.type === 'IDENTIFIER' || eqToken.type === 'KEYWORD') {
                const propName = eqToken.value;
                const propValueToken = this.tokens[k + 1];
                if (!propValueToken) {
                    throw new CompilerError(`Value required for eq property "${propName}"`, eqToken.line, eqToken.column, eqToken.length);
                }
                if (propValueToken.type !== 'DECIBEL') {
                    throw new CompilerError('EQ value must be in dB format e.g. +3db', propValueToken.line, propValueToken.column, propValueToken.length);
                }
                const numVal = parseFloat(propValueToken.value.replace(/db$/i, ''));
                if (propName === 'bass') {
                    eqNode.bass = numVal;
                } else if (propName === 'mid') {
                    eqNode.mid = numVal;
                } else if (propName === 'treble') {
                    eqNode.treble = numVal;
                } else {
                    throw new CompilerError(`Unknown eq property "${propName}"`, eqToken.line, eqToken.column, eqToken.length);
                }
                k += 2;
            } else {
                throw new CompilerError(`Unexpected token "${eqToken.value}" inside eq block`, eqToken.line, eqToken.column, eqToken.length);
            }
        }

        if (!closed) {
            throw new CompilerError('Expected } at the end of eq block', lbraceToken.line, lbraceToken.column, lbraceToken.length);
        }
        return { node: eqNode, endIndex: k };
    }

    /**
     * Parses `compress { threshold -18db  ratio 4:1  attack 5ms  release 100ms }`.
     * @returns The built CompressionNode and the index of the closing `}`.
     */
    private parseCompressBlock(
        j: number,
        keywordToken: Token,
        lbraceToken: Token
    ): { node: CompressionNode; endIndex: number } {
        let k = j + 2;
        const compressNode: CompressionNode = {
            type: 'COMPRESSION',
            line: keywordToken.line,
            column: keywordToken.column,
            length: 0,
        };
        let closed = false;

        while (k < this.tokens.length) {
            const compToken = this.tokens[k];
            if (!compToken) {
                throw new CompilerError('Unexpected end of file inside compress block', lbraceToken.line, lbraceToken.column, lbraceToken.length);
            }
            if (compToken.type === 'RBRACE') {
                compressNode.length = (compToken.column + compToken.length) - keywordToken.column;
                closed = true;
                break;
            }
            if (compToken.type === 'IDENTIFIER' || compToken.type === 'KEYWORD') {
                const propName = compToken.value;
                const propValueToken = this.tokens[k + 1];
                if (!propValueToken) {
                    throw new CompilerError(`Value required for compress property "${propName}"`, compToken.line, compToken.column, compToken.length);
                }

                if (propName === 'threshold') {
                    if (propValueToken.type !== 'DECIBEL') {
                        throw new CompilerError('Compression threshold must be in dB format e.g. -18db', propValueToken.line, propValueToken.column, propValueToken.length);
                    }
                    compressNode.threshold = parseFloat(propValueToken.value.replace(/db$/i, ''));
                } else if (propName === 'ratio') {
                    if (propValueToken.type === 'NUMBER') {
                        compressNode.ratio = parseInt(propValueToken.value);
                    } else if (propValueToken.type === 'AUDIO_RATIO') {
                        const parts = propValueToken.value.split(':');
                        compressNode.ratio = parseFloat(parts[0]!) / parseFloat(parts[1]!);
                    } else {
                        throw new CompilerError('Compression ratio must be a number or a ratio format (e.g., 4:1)', propValueToken.line, propValueToken.column, propValueToken.length);
                    }
                } else if (propName === 'attack') {
                    if (propValueToken.type === 'NUMBER') {
                        compressNode.attack = parseInt(propValueToken.value);
                    } else if (propValueToken.type === 'MILLISECOND') {
                        compressNode.attack = parseInt(propValueToken.value.replace('ms', ''));
                    } else {
                        throw new CompilerError('Compression attack must be a number or millisecond value (e.g., 10ms)', propValueToken.line, propValueToken.column, propValueToken.length);
                    }
                } else if (propName === 'release') {
                    if (propValueToken.type === 'NUMBER') {
                        compressNode.release = parseInt(propValueToken.value);
                    } else if (propValueToken.type === 'MILLISECOND') {
                        compressNode.release = parseInt(propValueToken.value.replace('ms', ''));
                    } else {
                        throw new CompilerError('Compression release must be a number or millisecond value (e.g., 100ms)', propValueToken.line, propValueToken.column, propValueToken.length);
                    }
                } else {
                    throw new CompilerError(`Unknown compress property "${propName}"`, compToken.line, compToken.column, compToken.length);
                }
                k += 2;
            } else {
                throw new CompilerError(`Unexpected token "${compToken.value}" inside compress block`, compToken.line, compToken.column, compToken.length);
            }
        }

        if (!closed) {
            throw new CompilerError('Expected } at the end of compress block', lbraceToken.line, lbraceToken.column, lbraceToken.length);
        }
        return { node: compressNode, endIndex: k };
    }
}
