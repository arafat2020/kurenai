import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `flip horizontal` | `flip vertical` */
export class FlipParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const next = this.tokens[i + 1];

        if (next === undefined) {
            throw new CompilerError(
                "Flip direction is required ('horizontal' or 'vertical')",
                token.line,
                token.column,
                token.length,
            );
        }
        if (next.type !== 'IDENTIFIER' || (next.value !== 'horizontal' && next.value !== 'vertical')) {
            throw new CompilerError(
                "Flip direction must be 'horizontal' or 'vertical'",
                next.line,
                next.column,
                next.length,
            );
        }

        target.flip = {
            type: 'FLIP',
            direction: next.value,
            line: next.line,
            column: next.column,
            length: next.length,
        };
        return i + 1;
    }
}
