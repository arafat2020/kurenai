import { CompilerError } from '../errors.js';
import { WatermarkPosition } from '../enums/parser.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `watermark "logo.png" top-left` */
export class WatermarkParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const fileToken = this.tokens[i + 1];
        const positionToken = this.tokens[i + 2];

        if (fileToken === undefined || positionToken === undefined) {
            throw new CompilerError('Both watermark file and position are required for watermarking', token.line, token.column, token.length);
        }
        if (fileToken.type !== 'STRING' || positionToken.type !== 'IDENTIFIER') {
            const err = fileToken.type !== 'STRING' ? fileToken : positionToken;
            throw new CompilerError('Watermark file must be a string and position must be a valid keyword', err.line, err.column, err.length);
        }

        target.watermark = {
            type: 'WATERMARK',
            file: fileToken.value.replace(/"/g, ''),
            position: positionToken.value as WatermarkPosition,
            line: token.line,
            column: token.column,
            length: (positionToken.column + positionToken.length) - token.column,
        };
        return i + 2;
    }
}
