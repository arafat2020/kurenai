import { CompilerError } from '../errors.js';
import { VideoCodec, AudioCodec } from '../enums/parser.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `encode h264 aac` */
export class EncodeParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const videoToken = this.tokens[i + 1];
        const audioToken = this.tokens[i + 2];

        if (videoToken === undefined || audioToken === undefined) {
            throw new CompilerError('Both video and audio codecs are required for encoding', token.line, token.column, token.length);
        }
        if (videoToken.type !== 'IDENTIFIER' || audioToken.type !== 'IDENTIFIER') {
            const err = videoToken.type !== 'IDENTIFIER' ? videoToken : audioToken;
            throw new CompilerError('Codec values must be valid keywords', err.line, err.column, err.length);
        }

        target.encode = {
            type: 'ENCODE',
            videoCodec: videoToken.value as VideoCodec,
            audioCodec: audioToken.value as AudioCodec,
            line: token.line,
            column: token.column,
            length: (audioToken.column + audioToken.length) - token.column,
        };
        return i + 2;
    }
}
