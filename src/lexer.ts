export type TokenType = 'KEYWORD' | 'IDENTIFIER' | 'NUMBER' | 'STRING' | 'RESOLUTION' ;

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

        const words = line.split(/\s+/);
        for (const word of words) {
            let tokenType: TokenType;

            if (isKeyword(word)) {
                tokenType = 'KEYWORD';
            } else if (isIdentifier(word)) {
                tokenType = 'IDENTIFIER';
            } else if (isNumber(word)) {
                tokenType = 'NUMBER';
            } else if (isString(word)) {
                tokenType = 'STRING';
            } else if (isResolution(word)) {
                tokenType = 'RESOLUTION';
            } else {
                throw new Error(`Unknown token: ${word} at line ${lineNumber + 1}`);
            }

            tokens.push({ type: tokenType, value: word, line: lineNumber + 1 });
        }
    }

    return tokens;
}

function isKeyword(word: string): boolean {
    const keywords = ['resize', 'input', 'fps', 'output', 'encode', 'bitrate', 'audio', 'watermark', 'thumbnail'];
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

module.exports = { lexer, isKeyword, isIdentifier, isNumber, isString, isResolution };

