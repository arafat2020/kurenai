import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `input "file.mp4"` */
export class InputParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const next = this.tokens[i + 1];

        if (next === undefined || next.type !== 'STRING') {
            const err = next ?? token;
            throw new CompilerError('File source is required', err.line, err.column, err.length);
        }

        target.input = {
            type: 'INPUT',
            value: next.value.replace(/"/g, ''),
            line: next.line,
            column: next.column,
            length: next.length,
        };
        return i + 1;
    }
}
