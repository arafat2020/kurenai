import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { type ProgramV2 } from '../interfaces/v2.js';
import { BaseParser } from './BaseParser.js';

/**
 * Parses: `clip NAME from SOURCE STARTs to ENDs`
 *
 * Registers a time-ranged clip into `program.clips`. The clip references a
 * named source and records its start / end timestamps in `Ns` format.
 *
 * Syntax:
 * ```crn
 * clip c_intro from intro 0s to 10s
 * clip c_main  from main  5s to 45s
 * ```
 *
 * Token layout (indices relative to `i`):
 * ```
 * 0  – clip   (KEYWORD)
 * 1  – NAME   (IDENTIFIER)
 * 2  – from   (KEYWORD)
 * 3  – SOURCE (IDENTIFIER)
 * 4  – START  (TIME,  e.g. "0s")
 * 5  – to     (KEYWORD)
 * 6  – END    (TIME,  e.g. "10s")
 * ```
 */
export class ClipParser extends BaseParser {
    parse(i: number, _target: Partial<Program>): number {
        const token       = this.tokens[i]!;
        const nameToken   = this.tokens[i + 1];
        const fromToken   = this.tokens[i + 2];
        const sourceToken = this.tokens[i + 3];
        const startToken  = this.tokens[i + 4];
        const toToken     = this.tokens[i + 5];
        const endToken    = this.tokens[i + 6];

        // NAME – must be an identifier
        if (!nameToken || nameToken.type !== 'IDENTIFIER') {
            throw new CompilerError(
                'Clip name is required',
                token.line, token.column, token.length,
            );
        }

        // from – literal keyword
        if (!fromToken || fromToken.type !== 'KEYWORD' || fromToken.value !== 'from') {
            throw new CompilerError(
                "Expected 'from' keyword after clip name",
                nameToken.line, nameToken.column, nameToken.length,
            );
        }

        // SOURCE – the name of a previously declared source
        if (!sourceToken || sourceToken.type !== 'IDENTIFIER') {
            throw new CompilerError(
                "Source name is required after 'from'",
                fromToken.line, fromToken.column, fromToken.length,
            );
        }

        // START – a TIME token (e.g. "5s")
        if (!startToken || startToken.type !== 'TIME') {
            throw new CompilerError(
                'Start time is required (e.g. 5s)',
                sourceToken.line, sourceToken.column, sourceToken.length,
            );
        }

        // to – literal keyword
        if (!toToken || toToken.type !== 'KEYWORD' || toToken.value !== 'to') {
            throw new CompilerError(
                "Expected 'to' keyword after start time",
                startToken.line, startToken.column, startToken.length,
            );
        }

        // END – a TIME token
        if (!endToken || endToken.type !== 'TIME') {
            throw new CompilerError(
                'End time is required (e.g. 30s)',
                toToken.line, toToken.column, toToken.length,
            );
        }

        const v2 = this.program as unknown as Partial<ProgramV2>;
        if (!v2.clips) v2.clips = {};

        v2.clips[nameToken.value] = {
            type:       'CLIP',
            name:       nameToken.value,
            sourceName: sourceToken.value,
            start:      startToken.value,
            end:        endToken.value,
            line:       token.line,
            column:     token.column,
            length:     (endToken.column + endToken.length) - token.column,
        };

        return i + 6;
    }
}
