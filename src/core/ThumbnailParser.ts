import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `thumbnail 15s` */
export class ThumbnailParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const next = this.tokens[i + 1];

        if (next === undefined) {
            throw new CompilerError('Thumbnail value is required', token.line, token.column, token.length);
        }
        if (next.type !== 'TIME') {
            throw new CompilerError("Thumbnail value must be a time value, e.g. '5s'", next.line, next.column, next.length);
        }

        target.thumbnail = {
            type: 'THUMBNAIL',
            value: next.value,
            line: next.line,
            column: next.column,
            length: next.length,
        };
        return i + 1;
    }
}
