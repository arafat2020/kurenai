import { readFileSync } from "node:fs";
import { lexer } from "./lexer.js";
import { parseTokens } from "./parser.js";
import { analyze } from "./analyzer.js";
import { generate } from "./codegen.js";

const filePath = process.argv[2];

if (!filePath) {
    console.error("Usage: tsx src/main.ts <file.crn>");
    process.exit(1);
}

if (!filePath.endsWith(".crn")) {
    console.error("Error: File must have a .crn extension.");
    process.exit(1);
}

try {
    const source = readFileSync(filePath, "utf-8");

    // Stage 1 — Lexing
    const tokens = lexer(source);

    // Stage 2 — Parsing
    const program = parseTokens(tokens);

    // Stage 3 — Semantic Analysis
    analyze(program);

    // Stage 4 — Code Generation
    const command = generate(program);

    console.log(command);
} catch (err) {
    if (err instanceof Error) {
        console.error(`Error: ${err.message}`);
    } else {
        console.error("An unknown error occurred.");
    }
    process.exit(1);
}
