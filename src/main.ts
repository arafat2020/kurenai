#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { lexer } from "./lexer.js";
import { parseTokens } from "./parser.js";
import { analyze } from "./analyzer.js";
import { generate } from "./codegen.js";
import { compileTarget, type CompileTarget } from "./index.js";
import { explain } from "./explain.js";
import { CompilerError } from "./errors.js";

const program = new Command();

program
    .name("kurenai")
    .description("Kurenai Compiler CLI")
    .version("2.2.0-beta.0");

/**
 * Helper function to read the `.crn` script from disk.
 * It strictly enforces the .crn extension requirement.
 * 
 * @param filePath The path to the script file
 * @returns The raw string content of the file
 */
function readFile(filePath: string): string {
    if (!filePath.endsWith(".crn")) {
        console.error("Error: File must have a .crn extension.");
        process.exit(1);
    }
    try {
        return readFileSync(filePath, "utf-8");
    } catch (err) {
        if (err instanceof Error) {
            console.error(`Error: ${err.message}`);
        } else {
            console.error("An unknown error occurred.");
        }
        process.exit(1);
    }
}

/**
 * Centrally format and report errors, printing a detailed 3-part layout if it's a CompilerError.
 */
function handleError(err: unknown, source: string, stage: string): void {
    if (err instanceof CompilerError) {
        const lines = source.split('\n');
        const lineText = lines[err.line - 1] ?? '';

        console.error(`Error on line ${err.line}:`);
        console.error(`  ${lineText}`);

        const padding = ' '.repeat(2 + (err.column - 1));
        const underlines = '^'.repeat(err.length);
        console.error(`${padding}${underlines}`);
        console.error(`  ${err.message}`);
    } else if (err instanceof Error) {
        console.error(`${stage} Error: ${err.message}`);
    } else {
        console.error(`An unknown error occurred during ${stage.toLowerCase()}.`);
    }
}

/**
 * CLI Command: validate
 * Parses and analyzes the given script without generating ffmpeg commands.
 * Useful for syntax and logic checking.
 */
program
    .command("validate <file>")
    .description("Runs lexer, parser, and analyzer to validate the file")
    .action((file) => {
        const source = readFile(file);
        try {
            const tokens = lexer(source);
            const ast = parseTokens(tokens);
            analyze(ast);
            console.log("File is valid.");
        } catch (err) {
            handleError(err, source, "Validation");
            process.exit(1);
        }
    });

/**
 * CLI Command: compile
 * Runs the compiler pipeline (lexer -> parser -> analyzer -> codegen)
 * and prints out the resulting FFmpeg commands (or WebCodecs plan if target specified).
 */
program
    .command("compile <file>")
    .description("Runs target dispatch pipeline and prints the compilation output")
    .option("--verbose", "Enable verbose output")
    .option("--target <target>", "Target platform (ffmpeg or webcodecs)", "ffmpeg")
    .action((file, options) => {
        const source = readFile(file);
        try {
            const target: CompileTarget = options.target === "webcodecs" ? "webcodecs" : "ffmpeg";
            const result = compileTarget(source, { verbose: options.verbose, target });

            if (result.target === "ffmpeg") {
                result.commands.forEach((cmd) => console.log(cmd));
            } else {
                console.log(JSON.stringify(result.plan, null, 2));
            }
        } catch (err) {
            handleError(err, source, "Compilation");
            process.exit(1);
        }
    });

/**
 * CLI Command: explain
 * Evaluates the script and outputs a human-readable breakdown
 * of what the script does (inputs, filters, encoding, etc.).
 */
program
    .command("explain <file>")
    .description("Explains what the .crn file will do in human-readable form")
    .action((file) => {
        const source = readFile(file);
        try {
            const tokens = lexer(source);
            const ast = parseTokens(tokens);
            analyze(ast);
            const commands = generate(ast);
            explain(ast, commands);
        } catch (err) {
            handleError(err, source, "Explain");
            process.exit(1);
        }
    });

/**
 * CLI Command: run
 * Executes the entire pipeline and actually runs the generated 
 * FFmpeg commands natively using the host system.
 */
program
    .command("run <file>")
    .description("Runs all stages and executes the FFmpeg command")
    .action((file) => {
        const source = readFile(file);
        try {
            const result = compileTarget(source, { target: "ffmpeg" });
            if (result.target !== "ffmpeg") {
                throw new Error(`kurenai run: target "${result.target}" cannot run from the CLI`);
            }

            for (const cmd of result.commands) {
                console.log(`Executing: ${cmd}`);
                execSync(cmd, { stdio: "inherit" });
            }
        } catch (err) {
            handleError(err, source, "Execution");
            process.exit(1);
        }
    });

program.parse(process.argv);
