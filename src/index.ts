import { lexer, type Token } from "./lexer.js";
import { parseTokens, type Program } from "./parser.js";
import { analyze } from "./analyzer.js";
import { generate } from "./codegen.js";
import { explain } from "./explain.js";
import { CompilerError } from "./errors.js";
import { type ProgramV2 } from "./interfaces/v2.js";

import { buildIR } from "./ir/analyzer.js";
import { type IR } from "./ir/types.js";
import { detectEnvironment, type RuntimeEnvironment } from "./runtime/environment.js";
import { resolveTarget, type CompileTarget, type TargetResolutionOptions } from "./runtime/target-resolver.js";
import {
    type CompileOutput,
    type FFmpegOutput,
    type WebCodecsOutput,
    type WebCodecsPipelinePlan,
    type ICodeGenerator,
} from "./targets/target.interface.js";
import { FFmpegCodeGenerator } from "./targets/ffmpeg/codegen.js";
import { WebCodecsCodeGenerator } from "./targets/webcodecs/codegen.js";

// ── Re-export core types & modules so consumers get everything from one import ──
export { CompilerError } from "./errors.js";
export { type Token, type TokenType } from "./lexer.js";
export { type Program, VideoCodec, AudioCodec, WatermarkPosition } from "./parser.js";
export { type ProgramV2, type SourceNode, type ClipNode, type TrackNode, type MixNode, type TimelineNode } from "./interfaces/v2.js";
export { SupportedVideoFormat } from "./analyzer.js";
export { videoCodecMap } from "./codegen.js";

// ── New Target & IR exports ──
export { buildIR, type IR };
export { detectEnvironment, type RuntimeEnvironment };
export { resolveTarget, type CompileTarget, type TargetResolutionOptions };
export {
    type CompileOutput,
    type FFmpegOutput,
    type WebCodecsOutput,
    type WebCodecsPipelinePlan,
    type ICodeGenerator,
};
export { FFmpegCodeGenerator };
export { WebCodecsCodeGenerator };

// ── Compilation result types ──

/**
 * The result of a successful compile() call.
 */
export interface CompileResult {
    /** The parsed and analyzed AST produced by the pipeline */
    ast: Program | ProgramV2;
    /** The final FFmpeg command string(s) ready to be executed */
    commands: string[];
}

/**
 * Options forwarded to compile(), compileTarget(), and Kurenai.compile().
 */
export interface CompileOptions {
    /** When true, logs each pipeline stage to stdout */
    verbose?: boolean;
    start?: number;   // seconds
    end?: number;     // seconds
    /** Target resolution options for compileTarget() */
    target?: CompileTarget | "auto";
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
 * @returns A fully constructed Program or ProgramV2 AST
 */
export function parse(tokens: Token[]): Program | ProgramV2 {
    return parseTokens(tokens);
}

/**
 * **Stage 3** – Analyze: perform semantic validation on an AST.
 * Throws a {@link CompilerError} if the program is semantically invalid.
 *
 * @param ast The Program AST produced by {@link parse}
 */
export function analyzeAst(ast: Program | ProgramV2): void {
    analyze(ast);
}

/**
 * **Stage 4** – Generate: translate a valid AST into FFmpeg command strings.
 *
 * @param ast The Program AST produced by {@link parse} (must be analyzed first)
 * @param options Optional compilation flags (e.g. `start`, `end`)
 * @returns An array of executable FFmpeg command strings
 */
export function generateCommands(ast: Program | ProgramV2): string[] {
    return generate(ast);
}

// ── Top-level compile functions ──

/**
 * Runs the complete Kurenai compilation pipeline in a single call (FFmpeg target only).
 * Retained for 100% backward compatibility with existing codebases.
 *
 * @param source A raw Kurenai DSL string
 * @param options Optional compilation flags
 * @returns A {@link CompileResult} containing the AST and the generated commands
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
    const commands = generate(ast, options);
    if (verbose) console.log("      ✓ Done\n");

    return { ast, commands };
}

/**
 * Explicit legacy helper for FFmpeg-only compilation.
 * Guarantees FFmpeg command output regardless of runtime environment.
 *
 * @param source A raw Kurenai DSL string
 * @param options Optional compilation flags
 * @returns Array of FFmpeg command strings
 */
export function compileToFFmpeg(source: string, options: CompileOptions = {}): string[] {
    const res = compileTarget(source, { ...options, target: "ffmpeg" });
    if (res.target === "ffmpeg") {
        return res.commands;
    }
    throw new CompilerError("Failed to resolve FFmpeg target", 1, 1, 0);
}

/**
 * New target-dispatch compilation pipeline:
 *
 * 1. **Lex** & **Parse** source to raw AST
 * 2. **Analyze & Normalize** to target-agnostic IR
 * 3. **Resolve Target** ("ffmpeg" | "webcodecs" based on environment or explicit option)
 * 4. **Generate Code** via target-specific code generator
 *
 * @param source Raw Kurenai DSL string
 * @param options Compilation and target resolution options
 * @returns A {@link CompileOutput} discriminated union (`FFmpegOutput` | `WebCodecsOutput`)
 */
export function compileTarget(source: string, options: CompileOptions = {}): CompileOutput {
    const { verbose = false, start, end, target: targetOpt } = options;

    if (verbose) console.log("[1/4] Lexing...");
    const tokens = lexer(source);

    if (verbose) console.log("[2/4] Parsing...");
    const ast = parseTokens(tokens);

    if (verbose) console.log("[3/4] Analyzing & Building IR...");
    const ir = buildIR(ast);

    const target = resolveTarget(targetOpt ? { target: targetOpt } : {});
    if (verbose) console.log(`      ✓ Target resolved to: "${target}"`);

    if (verbose) console.log("[4/4] Generating target output...");
    if (target === "ffmpeg") {
        const generator = new FFmpegCodeGenerator(start, end);
        return generator.generate(ir);
    } else {
        const generator = new WebCodecsCodeGenerator();
        return generator.generate(ir);
    }
}

// ── Kurenai class ──

/**
 * A class-based API that mirrors every CLI command as a method.
 */
export class Kurenai {
    lex(source: string): Token[] {
        return lexer(source);
    }

    parse(tokens: Token[]): Program | ProgramV2 {
        return parseTokens(tokens);
    }

    analyze(ast: Program | ProgramV2): void {
        analyze(ast);
    }

    generate(ast: Program | ProgramV2): string[] {
        return generate(ast);
    }

    compile(source: string, options: CompileOptions = {}): CompileResult {
        return compile(source, options);
    }

    compileTarget(source: string, options: CompileOptions = {}): CompileOutput {
        return compileTarget(source, options);
    }

    validate(source: string): void {
        const tokens = lexer(source);
        const ast = parseTokens(tokens);
        analyze(ast);
    }

    explain(source: string): void {
        const tokens = lexer(source);
        const ast = parseTokens(tokens);
        analyze(ast);
        const commands = generate(ast);
        explain(ast, commands);
    }

    run(source: string): void {
        const { execSync } = require("node:child_process") as typeof import("node:child_process");
        const { commands } = this.compile(source);

        for (const cmd of commands) {
            console.log(`Executing: ${cmd}`);
            execSync(cmd, { stdio: "inherit" });
        }
    }
}
