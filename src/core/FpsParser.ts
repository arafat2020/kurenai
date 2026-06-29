import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `fps 30` */
export class FpsParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const next = this.tokens[i + 1];

        if (next === undefined) {
            throw new CompilerError('FPS value is required', token.line, token.column, token.length);
        }
        if (next.type !== 'NUMBER') {
            throw new CompilerError('FPS value must be a number', next.line, next.column, next.length);
        }

        target.fps = {
            type: 'FPS',
            value: parseInt(next.value),
            line: next.line,
            column: next.column,
            length: next.length,
        };
        return i + 1;
    }
}
