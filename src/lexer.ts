export type TokenType = 'KEYWORD' | 'IDENTIFIER' | 'NUMBER' | 'STRING' | 'RESOLUTION' | 'BITRATE' | 'TIME' | 'LBRACE' | 'RBRACE';

export interface Token {
    type: TokenType;
    value: string;
    line: number;
}

function lexer(input: string): Token[] {
    const tokens: Token[] = [];
    const lines = input.split('\n');

    for (let lineNumber = 0; lineNumber < lines.length; lineNumber++) {
        const line = (lines[lineNumber] ?? '').trim();
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

            tokens.push({ type: tokenType, value: word, line: lineNumber + 1 });
        }
    }

    return tokens;
}

function isKeyword(word: string): boolean {
    const keywords = ['resize', 'input', 'fps', 'output', 'encode', 'bitrate', 'audio', 'watermark', 'thumbnail', 'profile', 'use'];
    return keywords.includes(word);
}

function isIdentifier(word: string): boolean {
    return /^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(word);
}

function isNumber(word: string): boolean {
    return /^\d+$/.test(word);
}

function isString(word: string): boolean {
    return /^".*"$/.test(word);
}

function isResolution(word: string): boolean {
    return /^\d+x\d+$/.test(word);
}

function isBitrate(word: string): boolean {
    return /^\d+[kmg]$/.test(word.toLowerCase());
}

function isTime(word: string): boolean {
    return /^\d+s$/.test(word.toLowerCase());
}

export { lexer, isKeyword, isIdentifier, isNumber, isString, isResolution, isBitrate, isTime };

