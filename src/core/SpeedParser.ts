import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `speed 1.5` or `speed 2` */
export class SpeedParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const next = this.tokens[i + 1];

        if (next === undefined) {
            throw new CompilerError('Speed value is required', token.line, token.column, token.length);
        }
        if (next.type !== 'FLOAT' && next.type !== 'NUMBER') {
            throw new CompilerError(
                "Speed must be a number, e.g. 'speed 1.5'",
                next.line,
                next.column,
                next.length,
            );
        }

        const value = parseFloat(next.value);
        if (!(value > 0) || value > 100) {
            throw new CompilerError(
                'Speed must be a positive number (typical range 0.25–4)',
                next.line,
                next.column,
                next.length,
            );
        }

        target.speed = {
            type: 'SPEED',
            value,
            line: next.line,
            column: next.column,
            length: next.length,
        };
        return i + 1;
    }
}
