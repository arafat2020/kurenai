import { type Token } from '../lexer.js';
import { type Program } from '../interfaces/parser.js';

/**
 * Callback type for the parser dispatcher — used by OutputParser and ProfileParser
 * to recursively parse inner keyword blocks.
 */
export type ParseCommandFn = (keyword: string, i: number, target: Partial<Program>) => number;

/**
 * Abstract base class for all keyword-specific parsers.
 *
 * Each subclass handles exactly one DSL keyword (e.g. `input`, `resize`, `audio`).
 * It receives shared access to the full token stream and the top-level Program
 * being constructed, then implements `parse(i, target)` to consume its tokens
 * and write results into `target`.
 */
export abstract class BaseParser {
    constructor(
        protected readonly tokens: Token[],
        protected readonly program: Partial<Program>
    ) {}

    /**
     * Parse the command starting at token index `i`, writing results into `target`.
     * @param i      Index of the keyword token itself in `this.tokens`.
     * @param target The Program (or sub-object) to write parsed nodes into.
     * @returns      The index of the last token consumed, so the caller can advance past it.
     */
    abstract parse(i: number, target: Partial<Program>): number;
}
