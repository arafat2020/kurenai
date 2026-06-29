import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser, type ParseCommandFn } from './BaseParser.js';

/**
 * Parses: `profile NAME { ...commands }`
 *
 * Needs a `parseCommand` callback to recursively parse the profile body
 * using the same dispatcher as top-level commands.
 */
export class ProfileParser extends BaseParser {
    constructor(
        tokens: ConstructorParameters<typeof BaseParser>[0],
        program: ConstructorParameters<typeof BaseParser>[1],
        private readonly parseCommand: ParseCommandFn
    ) {
        super(tokens, program);
    }

    parse(i: number, _target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const nameToken = this.tokens[i + 1];

        if (!nameToken || nameToken.type !== 'IDENTIFIER') {
            throw new CompilerError('Profile name is required', token.line, token.column, token.length);
        }

        const lbraceToken = this.tokens[i + 2];
        if (!lbraceToken || lbraceToken.type !== 'LBRACE') {
            throw new CompilerError('Expected { after profile name', nameToken.line, nameToken.column, nameToken.length);
        }

        const profileBody: Partial<Program> = {};
        let j = i + 3;

        while (j < this.tokens.length) {
            const innerToken = this.tokens[j];
            if (!innerToken) {
                throw new CompilerError('Unexpected end of file inside profile', lbraceToken.line, lbraceToken.column, lbraceToken.length);
            }
            if (innerToken.type === 'RBRACE') break;
            if (innerToken.type === 'KEYWORD') {
                j = this.parseCommand(innerToken.value, j, profileBody);
            } else {
                throw new CompilerError(`Unexpected token "${innerToken.value}" at line ${innerToken.line}`, innerToken.line, innerToken.column, innerToken.length);
            }
            j++;
        }

        if (j >= this.tokens.length) {
            throw new CompilerError('Expected } at the end of profile', lbraceToken.line, lbraceToken.column, lbraceToken.length);
        }

        const rbraceToken = this.tokens[j]!;

        if (!this.program.profiles) this.program.profiles = {};
        this.program.profiles[nameToken.value] = {
            type: 'PROFILE',
            name: nameToken.value,
            body: profileBody as any,
            line: token.line,
            column: token.column,
            length: (rbraceToken.column + rbraceToken.length) - token.column,
        };
        return j;
    }
}
