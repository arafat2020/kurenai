import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `rotate 90` | `rotate 180` | `rotate 270` */
export class RotateParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const next = this.tokens[i + 1];

        if (next === undefined) {
            throw new CompilerError('Rotate degrees are required', token.line, token.column, token.length);
        }
        if (next.type !== 'NUMBER') {
            throw new CompilerError(
                "Rotate must be 90, 180, or 270",
                next.line,
                next.column,
                next.length,
            );
        }

        const degrees = parseInt(next.value, 10);
        if (degrees !== 90 && degrees !== 180 && degrees !== 270) {
            throw new CompilerError(
                'Rotate must be 90, 180, or 270',
                next.line,
                next.column,
                next.length,
            );
        }

        target.rotate = {
            type: 'ROTATE',
            degrees: degrees as 90 | 180 | 270,
            line: next.line,
            column: next.column,
            length: next.length,
        };
        return i + 1;
    }
}
