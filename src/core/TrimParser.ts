import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `trim 10s 60s` (start + end) */
export class TrimParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const startTok = this.tokens[i + 1];
        const endTok = this.tokens[i + 2];

        if (startTok === undefined || endTok === undefined) {
            throw new CompilerError(
                "Trim requires start and end times, e.g. 'trim 10s 60s'",
                token.line,
                token.column,
                token.length,
            );
        }
        if (startTok.type !== 'TIME') {
            throw new CompilerError(
                "Trim start must be a time value, e.g. '10s'",
                startTok.line,
                startTok.column,
                startTok.length,
            );
        }
        if (endTok.type !== 'TIME') {
            throw new CompilerError(
                "Trim end must be a time value, e.g. '60s'",
                endTok.line,
                endTok.column,
                endTok.length,
            );
        }

        target.trim = {
            type: 'TRIM',
            start: startTok.value,
            end: endTok.value,
            line: token.line,
            column: token.column,
            length: (endTok.column + endTok.length) - token.column,
        };
        return i + 2;
    }
}
