import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { type ProgramV2 } from '../interfaces/v2.js';
import { BaseParser } from './BaseParser.js';

/**
 * Parses: `source NAME "file.mp4"`
 *
 * Registers a named input source into `program.sources`.
 * The name must be an identifier and the file path must be a quoted string.
 *
 * @example
 * ```crn
 * source intro "intro.mp4"
 * source music "bg.mp3"
 * ```
 */
export class SourceParser extends BaseParser {
    parse(i: number, _target: Partial<Program>): number {
        const token    = this.tokens[i]!;
        const nameToken = this.tokens[i + 1];
        const fileToken = this.tokens[i + 2];

        // NAME must be a plain identifier
        if (!nameToken || nameToken.type !== 'IDENTIFIER') {
            throw new CompilerError(
                'Source name is required',
                token.line, token.column, token.length,
            );
        }

        // FILE must be a quoted string
        if (!fileToken || fileToken.type !== 'STRING') {
            throw new CompilerError(
                'Source file path must be a quoted string, e.g. "intro.mp4"',
                nameToken.line, nameToken.column, nameToken.length,
            );
        }

        // Write into the V2 program's sources map (cast through any — BaseParser
        // types program as Partial<Program> but V2 uses Partial<ProgramV2>).
        const v2 = this.program as unknown as Partial<ProgramV2>;
        if (!v2.sources) v2.sources = {};

        v2.sources[nameToken.value] = {
            type: 'SOURCE',
            name: nameToken.value,
            file: fileToken.value.replace(/"/g, ''),
            line:   token.line,
            column: token.column,
            length: (fileToken.column + fileToken.length) - token.column,
        };

        return i + 2;
    }
}
