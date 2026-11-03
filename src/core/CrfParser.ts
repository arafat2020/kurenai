import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `crf 23` */
export class CrfParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const next = this.tokens[i + 1];

        if (next === undefined) {
            throw new CompilerError('CRF value is required', token.line, token.column, token.length);
        }
        if (next.type !== 'NUMBER') {
            throw new CompilerError(
                "CRF must be an integer, e.g. 'crf 23'",
                next.line,
                next.column,
                next.length,
            );
        }

        const value = parseInt(next.value, 10);
        if (value < 0 || value > 51) {
            throw new CompilerError(
                'CRF must be between 0 and 51',
                next.line,
                next.column,
                next.length,
            );
        }

        target.crf = {
            type: 'CRF',
            value,
            line: next.line,
            column: next.column,
            length: next.length,
        };
        return i + 1;
    }
}
