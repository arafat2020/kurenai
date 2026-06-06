#!/usr/bin/env node
import { Command } from "commander";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { lexer } from "./lexer.js";
import { parseTokens } from "./parser.js";
import { analyze } from "./analyzer.js";
import { generate } from "./codegen.js";

const program = new Command();

program
    .name("kurenai")
    .description("Kurenai Compiler CLI")
    .version("1.0.0");

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
            if (err instanceof Error) {
                console.error(`Validation Error: ${err.message}`);
            } else {
                console.error("An unknown error occurred during validation.");
            }
            process.exit(1);
        }
    });

program
    .command("compile <file>")
    .description("Runs all stages and prints the FFmpeg command")
    .option("--verbose", "Enable verbose output")
    .action((file, options) => {
        const source = readFile(file);
        try {
            if (options.verbose) console.log('[1/4] Lexing...');
            const tokens = lexer(source);
            if (options.verbose) console.log(`      ✓ ${tokens.length} tokens`);

            if (options.verbose) console.log('[2/4] Parsing...');
            const ast = parseTokens(tokens);
            if (options.verbose) console.log('      ✓ AST built');

            if (options.verbose) console.log('[3/4] Analyzing...');
            analyze(ast);
            if (options.verbose) console.log('      ✓ Valid');

            if (options.verbose) console.log('[4/4] Generating...');
            const commands = generate(ast);
            if (options.verbose) console.log('      ✓ Done\n');

            commands.forEach((cmd) => console.log(cmd));
        } catch (err) {
            if (err instanceof Error) {
                console.error(`Compilation Error: ${err.message}`);
            } else {
                console.error("An unknown error occurred during compilation.");
            }
            process.exit(1);
        }
    });

program
    .command("run <file>")
    .description("Runs all stages and executes the FFmpeg command")
    .action((file) => {
        const source = readFile(file);
        try {
            const tokens = lexer(source);
            const ast = parseTokens(tokens);
            analyze(ast);
            const commands = generate(ast);
            
            for (const cmd of commands) {
                console.log(`Executing: ${cmd}`);
                execSync(cmd, { stdio: "inherit" });
            }
        } catch (err) {
            if (err instanceof Error) {
                console.error(`Execution Error: ${err.message}`);
            } else {
                console.error("An unknown error occurred during execution.");
            }
            process.exit(1);
        }
    });

program.parse(process.argv);
