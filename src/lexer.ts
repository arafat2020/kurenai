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

    // Iterate through each line of the input
    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        const line = (lines[lineNumber] ?? '').trim();
        
        // Skip empty lines to ignore whitespace
        if (line.length === 0) continue;

        // Split on whitespace, then further split on brace boundaries
        // so that "name{" becomes ["name", "{"] and "}" stays ["}"]
        const rawWords = line.split(/\s+/);
        const words: string[] = [];
        for (const w of rawWords) {
            // Split around { and } while keeping them as separate tokens
            const parts = w.split(/([{}])/).filter(p => p.length > 0);
            words.push(...parts);
        }
        
        // Categorize each extracted word into a specific TokenType
        for (const word of words) {
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
                throw new Error(`Unknown token: ${word} at line ${lineNumber + 1}`);
            }

            // Push the classified token to our tokens array
            tokens.push({ type: tokenType, value: word, line: lineNumber + 1 });
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

