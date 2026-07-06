import { type Token } from './lexer.js';
import { CompilerError } from './errors.js';
import { type Program } from './interfaces/parser.js';
import { type ProgramV2 } from './interfaces/v2.js';
import { type ParseCommandFn } from './core/BaseParser.js';

// ── V2-specific keyword parsers ──────────────────────────────────────────────
import { SourceParser }   from './core/SourceParser.js';
import { ClipParser }     from './core/ClipParser.js';
import { MixParser }      from './core/MixParser.js';
import { TimelineParser } from './core/TimelineParser.js';

// ── Shared V1 keyword parsers (unchanged) ─────────────────────────────────────
import { OutputParser }   from './core/OutputParser.js';
import { EncodeParser }   from './core/EncodeParser.js';
import { BitrateParser }  from './core/BitrateParser.js';
import { AudioParser }    from './core/AudioParser.js';
import { WatermarkParser } from './core/WatermarkParser.js';
import { ThumbnailParser } from './core/ThumbnailParser.js';
import { ProfileParser }  from './core/ProfileParser.js';
import { UseParser }      from './core/UseParser.js';
import { ResizeParser }   from './core/ResizeParser.js';
import { FpsParser }      from './core/FpsParser.js';

/**
 * Stateful V2 parser that converts a flat token array produced by the lexer
 * into a {@link ProgramV2} AST.
 *
 * Architecture mirrors the V1 {@link Parser} class in `parser.ts`:
 * - The mutable program being built is held as `this.program`.
 * - `parseCommand` dispatches each keyword token to its dedicated `*Parser`
 *   class in `src/core/`.
 * - V2-only keywords (`source`, `clip`, `mix`, `timeline`) go to the four
 *   new V2 parsers.
 * - All existing V1 keyword parsers (`encode`, `bitrate`, `audio`, etc.) are
 *   reused without modification, maintaining full backward compatibility.
 * - Recursive dispatch (required by {@link OutputParser} and
 *   {@link ProfileParser} for their inner blocks) is provided by binding
 *   `parseCommand` as a stable callback.
 */
class ParserV2 {
    private readonly program: Partial<ProgramV2>;

    constructor(private readonly tokens: Token[]) {
        this.program = {
            type:     'PROGRAM',
            line:     tokens[0]?.line   ?? 1,
            column:   tokens[0]?.column ?? 1,
            length:   tokens[0]?.length ?? 0,
            version:  2,
            sources:  {},
            clips:    {},
            mixes:    {},
            timeline: null,
            profiles: {},
            outputs:  [],
        };
    }

    /**
     * Dispatches a single keyword token to the matching core parser class.
     *
     * V2-only keywords are handled by the new parsers in `src/core/`.
     * All V1 keywords are delegated to their existing parser classes —
     * the `program` object is cast so that `BaseParser`'s typed API is
     * satisfied while still targeting the V2 program being built.
     *
     * @param keyword The keyword string value of the current token.
     * @param i       Index of the keyword token in `this.tokens`.
     * @param target  The object to write parsed nodes into (top-level program
     *                or an inner override / profile body).
     * @returns       The index of the last token consumed so the caller can
     *                advance past it with `i++`.
     */
    private parseCommand(keyword: string, i: number, target: Partial<Program>): number {
        const { tokens, program } = this;
        // Bind once so OutputParser / ProfileParser receive a stable reference
        const dispatch: ParseCommandFn = this.parseCommand.bind(this);
        const token = tokens[i]!;

        // Alias for passing the V2 program to parsers typed against V1 Program
        const v1Program = program as any;

        switch (keyword) {
            // ── V2-only keywords ────────────────────────────────────────────
            case 'source':   return new SourceParser(tokens,   v1Program).parse(i, target as any);
            case 'clip':     return new ClipParser(tokens,     v1Program).parse(i, target as any);
            case 'mix':      return new MixParser(tokens,      v1Program).parse(i, target as any);
            case 'timeline': return new TimelineParser(tokens, v1Program).parse(i, target as any);

            // ── V1 shared keywords ──────────────────────────────────────────
            case 'encode':    return new EncodeParser(tokens,    v1Program).parse(i, target as any);
            case 'bitrate':   return new BitrateParser(tokens,   v1Program).parse(i, target as any);
            case 'audio':     return new AudioParser(tokens,     v1Program).parse(i, target as any);
            case 'watermark': return new WatermarkParser(tokens, v1Program).parse(i, target as any);
            case 'thumbnail': return new ThumbnailParser(tokens, v1Program).parse(i, target as any);
            case 'output':    return new OutputParser(tokens,    v1Program, dispatch).parse(i, target as any);
            case 'profile':   return new ProfileParser(tokens,   v1Program, dispatch).parse(i, target as any);
            case 'use':       return new UseParser(tokens,       v1Program).parse(i, target as any);
            case 'resize':    return new ResizeParser(tokens,    v1Program).parse(i, target as any);
            case 'fps':       return new FpsParser(tokens,       v1Program).parse(i, target as any);

            default:
                throw new CompilerError(
                    `Unknown keyword: ${keyword}`,
                    token.line, token.column, token.length,
                );
        }
    }

    /**
     * Main parse loop — walks top-level tokens and delegates each keyword.
     * Only `KEYWORD` tokens are valid at the top level; anything else throws.
     *
     * @returns A fully constructed {@link ProgramV2} AST.
     */
    parse(): ProgramV2 {
        let i = 0;
        while (i < this.tokens.length) {
            const token = this.tokens[i];
            if (!token) break;

            if (token.type === 'KEYWORD') {
                i = this.parseCommand(token.value, i, this.program as any);
            } else {
                throw new CompilerError(
                    `Unexpected token "${token.value}"`,
                    token.line, token.column, token.length,
                );
            }
            i++;
        }
        return this.program as ProgramV2;
    }
}

/**
 * Core V2 parsing function. Converts a token array into a {@link ProgramV2} AST.
 *
 * @param tokens Token array generated by the lexer for a V2 `.crn` script.
 * @returns      A fully constructed ProgramV2 AST object.
 */
export const parseTokensV2 = (tokens: Token[]): ProgramV2 => new ParserV2(tokens).parse();
