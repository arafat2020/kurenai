import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `resize 1920x1080` */
export class ResizeParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const next = this.tokens[i + 1];

        if (next === undefined) {
            throw new CompilerError('Resize value is required', token.line, token.column, token.length);
        }
        if (next.type !== 'RESOLUTION') {
            throw new CompilerError('Resolution Value must be a valid source. Eg 1280x720', next.line, next.column, next.length);
        }

        const parts = next.value.split('x');
        if (parts.length !== 2) {
            throw new CompilerError('Resolution value must be in the format WIDTHxHEIGHT. Eg 1280x720', next.line, next.column, next.length);
        }

        target.resize = {
            type: 'RESIZE',
            width: parseInt(parts[0]!),
            height: parseInt(parts[1]!),
            line: next.line,
            column: next.column,
            length: next.length,
        };
        return i + 1;
    }
}
