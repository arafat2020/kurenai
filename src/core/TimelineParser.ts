import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { type ProgramV2 } from '../interfaces/v2.js';
import { BaseParser } from './BaseParser.js';

/**
 * Parses: `timeline { CLIP_NAME CLIP_NAME ... }`
 *
 * Records the ordered sequence of clip names that make up the final video
 * into `program.timeline`.
 *
 * Syntax:
 * ```crn
 * timeline {
 *   c_intro
 *   c_main
 *   c_outro
 * }
 * ```
 *
 * All tokens inside the braces must be `IDENTIFIER` tokens corresponding to
 * previously declared clip names (validated at the analyzer stage).
 */
export class TimelineParser extends BaseParser {
    parse(i: number, _target: Partial<Program>): number {
        const token       = this.tokens[i]!;
        const lbraceToken = this.tokens[i + 1];

        // Opening brace
        if (!lbraceToken || lbraceToken.type !== 'LBRACE') {
            throw new CompilerError(
                "Expected '{' at the start of timeline block",
                token.line, token.column, token.length,
            );
        }

        const clips: string[] = [];
        let j = i + 2;
        let closingToken = lbraceToken;

        while (j < this.tokens.length) {
            const inner = this.tokens[j];

            if (!inner) {
                throw new CompilerError(
                    'Unexpected end of file inside timeline block',
                    lbraceToken.line, lbraceToken.column, lbraceToken.length,
                );
            }

            // Closing brace — stop
            if (inner.type === 'RBRACE') {
                closingToken = inner;
                break;
            }

            // Only identifiers are permitted inside the timeline block
            if (inner.type !== 'IDENTIFIER') {
                throw new CompilerError(
                    `Expected a clip name inside timeline block, got "${inner.value}"`,
                    inner.line, inner.column, inner.length,
                );
            }

            clips.push(inner.value);
            j++;
        }

        if (j >= this.tokens.length) {
            throw new CompilerError(
                "Expected '}' at the end of timeline block",
                lbraceToken.line, lbraceToken.column, lbraceToken.length,
            );
        }

        const v2 = this.program as unknown as Partial<ProgramV2>;
        v2.timeline = {
            type:   'TIMELINE',
            clips,
            line:   token.line,
            column: token.column,
            length: (closingToken.column + closingToken.length) - token.column,
        };

        return j;
    }
}
