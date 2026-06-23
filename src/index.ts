import { lexer, type Token } from "./lexer.js";
import { parseTokens, type Program } from "./parser.js";
import { analyze } from "./analyzer.js";
import { generate } from "./codegen.js";
import { explain } from "./explain.js";
import { CompilerError } from "./errors.js";

// ── Re-export core types so consumers get everything from one import ──
export { CompilerError } from "./errors.js";
export { type Token, type TokenType } from "./lexer.js";
export { type Program, VideoCodec, AudioCodec, WatermarkPosition } from "./parser.js";
export { SupportedVideoFormat } from "./analyzer.js";
export { videoCodecMap } from "./codegen.js";

// ── Compilation result types ──

/**
 * The result of a successful compile() call.
 */
export interface CompileResult {
    /** The parsed and analyzed AST produced by the pipeline */
    ast: Program;
    /** The final FFmpeg command string(s) ready to be executed */
    commands: string[];
}

/**
 * Options forwarded to compile() and Kurenai.compile().
 */
export interface CompileOptions {
    /** When true, logs each pipeline stage to stdout */
    verbose?: boolean;
}

// ── Pipeline stages ──

/**
 * **Stage 1** – Lex: tokenise a raw DSL string.
 *
 * @param source The raw `.crn` script content
 * @returns An array of Tokens
 */
export function lex(source: string): Token[] {
    return lexer(source);
}

/**
 * **Stage 2** – Parse: convert tokens into an AST.
 *
 * @param tokens Tokens produced by {@link lex}
 * @returns A fully constructed Program AST
 */
export function parse(tokens: Token[]): Program {
    return parseTokens(tokens);
}

/**
 * **Stage 3** – Analyze: perform semantic validation on an AST.
 * Throws a {@link CompilerError} if the program is semantically invalid.
 *
 * @param ast The Program AST produced by {@link parse}
 */
export function analyzeAst(ast: Program): void {
    analyze(ast);
}

/**
 * **Stage 4** – Generate: translate a valid AST into FFmpeg command strings.
 *
 * @param ast The Program AST produced by {@link parse} (must be analyzed first)
 * @returns An array of executable FFmpeg command strings
 */
export function generateCommands(ast: Program): string[] {
    return generate(ast);
}

// ── Top-level compile function ──

/**
 * Runs the complete Kurenai compilation pipeline in a single call:
 *
 * 1. **Lex** – tokenise the DSL source string
 * 2. **Parse** – build the Abstract Syntax Tree
 * 3. **Analyze** – validate semantics (codecs, formats, FPS bounds, …)
 * 4. **Generate** – emit FFmpeg command string(s)
 *
 * @param source A raw Kurenai DSL string (the contents of a `.crn` file)
 * @param options Optional compilation flags (e.g. `verbose`)
 * @returns A {@link CompileResult} containing the AST and the generated commands
 *
 * @throws {CompilerError} When any compilation stage fails
 *
 * @example
 * ```ts
 * import { compile } from "@arafat2020/kurenai";
 *
 * const { commands } = compile(`
 *   input "video.mp4"
 *   resize 1280x720
 *   encode h264 aac
 *   output "out.mp4"
 * `);
 *
 * console.log(commands[0]); // ffmpeg -i video.mp4 …
 * ```
 */
export function compile(source: string, options: CompileOptions = {}): CompileResult {
    const { verbose = false } = options;

    if (verbose) console.log("[1/4] Lexing...");
    const tokens = lexer(source);
    if (verbose) console.log(`      ✓ ${tokens.length} tokens`);

    if (verbose) console.log("[2/4] Parsing...");
    const ast = parseTokens(tokens);
    if (verbose) console.log("      ✓ AST built");

    if (verbose) console.log("[3/4] Analyzing...");
    analyze(ast);
    if (verbose) console.log("      ✓ Valid");

    if (verbose) console.log("[4/4] Generating...");
    const commands = generate(ast);
    if (verbose) console.log("      ✓ Done\n");

    return { ast, commands };
}

// ── Kurenai class ──

/**
 * A class-based API that mirrors every CLI command as a method.
 * Useful when you need fine-grained control or want to reuse an instance.
 *
 * @example
 * ```ts
 * import { Kurenai } from "@arafat2020/kurenai";
 *
 * const k = new Kurenai();
 *
 * // Compile and get commands
 * const commands = k.compile(source);
 *
 * // Validate only (no codegen)
 * k.validate(source);
 *
 * // Print a human-readable breakdown
 * k.explain(source);
 * ```
 */
export class Kurenai {
    /**
     * Tokenises the DSL source string (Stage 1).
     *
     * @param source Raw Kurenai DSL string
     * @returns Token array
     */
    lex(source: string): Token[] {
        return lexer(source);
    }

    /**
     * Converts a token array into a Program AST (Stage 2).
     *
     * @param tokens Tokens produced by {@link Kurenai.lex}
     * @returns Program AST
     */
    parse(tokens: Token[]): Program {
        return parseTokens(tokens);
    }

    /**
     * Performs semantic analysis on the AST (Stage 3).
     * Throws {@link CompilerError} if the program is invalid.
     *
     * @param ast Program AST produced by {@link Kurenai.parse}
     */
    analyze(ast: Program): void {
        analyze(ast);
    }

    /**
     * Generates FFmpeg command string(s) from a valid AST (Stage 4).
     *
     * @param ast Analyzed Program AST
     * @returns Array of FFmpeg command strings
     */
    generate(ast: Program): string[] {
        return generate(ast);
    }

    /**
     * **CLI `compile` equivalent** – runs all 4 stages and returns the results.
     *
     * @param source Raw Kurenai DSL string
     * @param options Optional compilation flags
     * @returns {@link CompileResult} containing the AST and generated commands
     * @throws {CompilerError} on any pipeline failure
     */
    compile(source: string, options: CompileOptions = {}): CompileResult {
        return compile(source, options);
    }

    /**
     * **CLI `validate` equivalent** – runs Stages 1-3 (lex → parse → analyze)
     * without performing code generation. Ideal for syntax and semantic checking.
     *
     * @param source Raw Kurenai DSL string
     * @throws {CompilerError} if the source is syntactically or semantically invalid
     */
    validate(source: string): void {
        const tokens = lexer(source);
        const ast = parseTokens(tokens);
        analyze(ast);
    }

    /**
     * **CLI `explain` equivalent** – runs the full pipeline then prints a
     * human-readable breakdown of inputs, filters, encoding, and the generated
     * FFmpeg command(s) to stdout.
     *
     * @param source Raw Kurenai DSL string
     * @throws {CompilerError} on any pipeline failure
     */
    explain(source: string): void {
        const tokens = lexer(source);
        const ast = parseTokens(tokens);
        analyze(ast);
        const commands = generate(ast);
        explain(ast, commands);
    }

    /**
     * **CLI `run` equivalent** – compiles the source and executes each generated
     * FFmpeg command synchronously via the host shell.
     *
     * > **Note:** This method requires Node.js and will throw at runtime in
     * > non-Node environments (e.g., browsers, Deno without `--allow-run`).
     *
     * @param source Raw Kurenai DSL string
     * @throws {CompilerError} on pipeline failure
     * @throws {Error} if FFmpeg is not installed or any command fails
     */
    run(source: string): void {
        const { execSync } = require("node:child_process") as typeof import("node:child_process");
        const { commands } = this.compile(source);

        for (const cmd of commands) {
            console.log(`Executing: ${cmd}`);
            execSync(cmd, { stdio: "inherit" });
        }
    }
}
