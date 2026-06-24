import { CompilerError } from "./errors.js";

/**
 * Defines the types of tokens that the lexer can recognize.
 */
export type TokenType = 'KEYWORD' | 'IDENTIFIER' | 'NUMBER' | 'STRING' | 'RESOLUTION' | 'BITRATE' | 'TIME' | 'LBRACE' | 'RBRACE';

/**
 * Represents a single token extracted from the input script.
 */
export interface Token {
    type: TokenType;
    value: string;
    line: number;
    column: number;
    length: number;
}

/**
 * The lexer (tokenizer) converts the raw string input into an array of Tokens.
 * It processes the input line by line and splits words by spaces and braces.
 * 
 * @param input The raw Kurenai script string
 * @returns An array of parsed Tokens
 */
function lexer(input: string): Token[] {
    const tokens: Token[] = [];
    const lines = input.split('\n');
    const tokenRegex = /([{}])|("[^"]*")|([^\s{}]+)/g;

    // Iterate through each line of the input
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        const rawLine = (lines[lineNumber] ?? '').split('#')[0]!;
        const line = rawLine; // don't trim — preserve column positions

        if (rawLine.trim().length === 0) continue;

        // Skip empty/whitespace-only lines
        if (line.trim().length === 0) continue;
        if (line.startsWith('#')) continue;

        tokenRegex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = tokenRegex.exec(line)) !== null) {
            const word = match[0];
            const column = match.index + 1;
            const length = word.length;
            let tokenType: TokenType;

            if (word === '{') {
                tokenType = 'LBRACE';
            } else if (word === '}') {
                tokenType = 'RBRACE';
            } else if (isKeyword(word)) {
                tokenType = 'KEYWORD';
            } else if (isIdentifier(word)) {
                tokenType = 'IDENTIFIER';
            } else if (isNumber(word)) {
                tokenType = 'NUMBER';
            } else if (isString(word)) {
                tokenType = 'STRING';
            } else if (isResolution(word)) {
                tokenType = 'RESOLUTION';
            } else if (isBitrate(word)) {
                tokenType = 'BITRATE';
            } else if (isTime(word)) {
                tokenType = 'TIME';
            } else {
                throw new CompilerError(`Unknown token: ${word}`, lineNumber + 1, column, length);
            }

            // Push the classified token to our tokens array
            tokens.push({ type: tokenType, value: word, line: lineNumber + 1, column, length });
        }
    }

    return tokens;
}


// ── Helper functions for token categorization ──

/** Checks if a word is a built-in Kurenai keyword */
function isKeyword(word: string): boolean {
    const keywords = ['resize', 'input', 'fps', 'output', 'encode', 'bitrate', 'audio', 'watermark', 'thumbnail', 'profile', 'use'];
    return keywords.includes(word);
}

/** Checks if a word is a valid identifier (e.g., variable or profile name) */
function isIdentifier(word: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(word);
}

/** Checks if a word is a raw number */
function isNumber(word: string): boolean {
    return /^\d+$/.test(word);
}

/** Checks if a word is a quoted string */
function isString(word: string): boolean {
    return /^".*"$/.test(word);
}

/** Checks if a word is a resolution format (e.g., 1920x1080) */
function isResolution(word: string): boolean {
    return /^\d+x\d+$/.test(word);
}

/** Checks if a word is a bitrate format (e.g., 500k, 2M) */
function isBitrate(word: string): boolean {
    return /^\d+[kmg]$/.test(word.toLowerCase());
}

/** Checks if a word is a time format (e.g., 5s) */
function isTime(word: string): boolean {
    return /^\d+s$/.test(word.toLowerCase());
}

export { lexer, isKeyword, isIdentifier, isNumber, isString, isResolution, isBitrate, isTime };

