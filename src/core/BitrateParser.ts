import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `bitrate 5000k` */
export class BitrateParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const next = this.tokens[i + 1];

        if (next === undefined) {
            throw new CompilerError('Bitrate value is required', token.line, token.column, token.length);
        }
        if (next.type !== 'BITRATE') {
            throw new CompilerError("Bitrate value must be a string with units, e.g. '500k' or '2M'", next.line, next.column, next.length);
        }

        target.bitrate = {
            type: 'BITRATE',
            value: next.value,
            line: next.line,
            column: next.column,
            length: next.length,
        };
        return i + 1;
    }
}
