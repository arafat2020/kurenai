import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { type ProgramV2, type MixNode } from '../interfaces/v2.js';
import { BaseParser } from './BaseParser.js';

/**
 * Parses: `mix NAME { track SOURCE volume N.NN  ... }`
 *
 * Registers a named audio mix into `program.mixes`. Each `track` sub-statement
 * inside the block records a source name and its volume gain (float).
 *
 * Syntax:
 * ```crn
 * mix bg {
 *   track music volume 0.3
 *   track voice volume 1.0
 * }
 * ```
 *
 * Inner token layout (per `track` line):
 * ```
 * 0  – track   (KEYWORD)
 * 1  – SOURCE  (IDENTIFIER)
 * 2  – volume  (KEYWORD)
 * 3  – N.NN    (FLOAT)
 * ```
 */
export class MixParser extends BaseParser {
    parse(i: number, _target: Partial<Program>): number {
        const token      = this.tokens[i]!;
        const nameToken  = this.tokens[i + 1];
        const lbraceToken = this.tokens[i + 2];

        // NAME – must be an identifier
        if (!nameToken || nameToken.type !== 'IDENTIFIER') {
            throw new CompilerError(
                'Mix name is required',
                token.line, token.column, token.length,
            );
        }

        // Opening brace
        if (!lbraceToken || lbraceToken.type !== 'LBRACE') {
            throw new CompilerError(
                "Expected '{' at the start of mix block",
                nameToken.line, nameToken.column, nameToken.length,
            );
        }

        const mixNode: MixNode = {
            type:   'MIX',
            name:   nameToken.value,
            tracks: [],
            line:   token.line,
            column: token.column,
            length: 0,
        };

        let j = i + 3;
        let closingToken = lbraceToken;

        // Walk the inner tokens until we hit the closing brace
        while (j < this.tokens.length) {
            const inner = this.tokens[j];

            if (!inner) {
                throw new CompilerError(
                    'Unexpected end of file inside mix block',
                    lbraceToken.line, lbraceToken.column, lbraceToken.length,
                );
            }

            // Closing brace — stop
            if (inner.type === 'RBRACE') {
                closingToken = inner;
                break;
            }

            // Each inner statement must start with the 'track' keyword
            if (inner.type !== 'KEYWORD' || inner.value !== 'track') {
                throw new CompilerError(
                    `Expected 'track' keyword inside mix block, got "${inner.value}"`,
                    inner.line, inner.column, inner.length,
                );
            }

            // track SOURCE volume N.NN
            const sourceToken  = this.tokens[j + 1];
            const volKeyToken  = this.tokens[j + 2];
            const volValToken  = this.tokens[j + 3];

            if (!sourceToken || sourceToken.type !== 'IDENTIFIER') {
                throw new CompilerError(
                    'Track source name is required after track',
                    inner.line, inner.column, inner.length,
                );
            }
            if (!volKeyToken || volKeyToken.type !== 'KEYWORD' || volKeyToken.value !== 'volume') {
                throw new CompilerError(
                    "Expected 'volume' keyword after track source name",
                    sourceToken.line, sourceToken.column, sourceToken.length,
                );
            }
            if (!volValToken || volValToken.type !== 'FLOAT') {
                throw new CompilerError(
                    'Expected a float volume value (e.g. 0.8)',
                    volKeyToken.line, volKeyToken.column, volKeyToken.length,
                );
            }

            mixNode.tracks.push({
                type:       'TRACK',
                sourceName: sourceToken.value,
                volume:     parseFloat(volValToken.value),
                line:       inner.line,
                column:     inner.column,
                length:     (volValToken.column + volValToken.length) - inner.column,
            });

            j += 4; // advance past: track SOURCE volume N.NN
        }

        if (j >= this.tokens.length) {
            throw new CompilerError(
                "Expected '}' at the end of mix block",
                lbraceToken.line, lbraceToken.column, lbraceToken.length,
            );
        }

        // Compute the total span of the mix statement
        mixNode.length = (closingToken.column + closingToken.length) - token.column;

        const v2 = this.program as unknown as Partial<ProgramV2>;
        if (!v2.mixes) v2.mixes = {};
        v2.mixes[nameToken.value] = mixNode;

        return j;
    }
}
