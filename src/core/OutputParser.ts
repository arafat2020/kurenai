import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser, type ParseCommandFn } from './BaseParser.js';

/**
 * Parses: `output "file.mp4"` or `output "file.mp4" { ...overrides }`
 *
 * Accepts a `parseCommand` callback so it can recursively parse the contents
 * of the optional override block `{ resize 1920x1080 fps 30 ... }`.
 */
export class OutputParser extends BaseParser {
    constructor(
        tokens: ConstructorParameters<typeof BaseParser>[0],
        program: ConstructorParameters<typeof BaseParser>[1],
        private readonly parseCommand: ParseCommandFn
    ) {
        super(tokens, program);
    }

    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const nextOutputToken = this.tokens[i + 1];

        if (nextOutputToken === undefined) {
            throw new CompilerError('File source is required', token.line, token.column, token.length);
        }
        if (nextOutputToken.type !== 'STRING') {
            throw new CompilerError('Value must be a valid source', nextOutputToken.line, nextOutputToken.column, nextOutputToken.length);
        }

        const fileValue = nextOutputToken.value.replace(/"/g, '');
        const overrides: Partial<Program> = {};
        let j = i + 1;
        let endToken = nextOutputToken;

        const lbraceToken = this.tokens[j + 1];
        if (lbraceToken && lbraceToken.type === 'LBRACE') {
            j += 2;
            while (j < this.tokens.length) {
                const innerToken = this.tokens[j];
                if (!innerToken) {
                    throw new CompilerError('Unexpected end of file inside output block', lbraceToken.line, lbraceToken.column, lbraceToken.length);
                }
                if (innerToken.type === 'RBRACE') {
                    endToken = innerToken;
                    break;
                }
                if (innerToken.type === 'KEYWORD') {
                    j = this.parseCommand(innerToken.value, j, overrides);
                } else {
                    throw new CompilerError(`Unexpected token "${innerToken.value}" at line ${innerToken.line}`, innerToken.line, innerToken.column, innerToken.length);
                }
                j++;
            }

            if (j >= this.tokens.length) {
                throw new CompilerError('Expected } at the end of output block', lbraceToken.line, lbraceToken.column, lbraceToken.length);
            }
        }

        if (!target.outputs) target.outputs = [];
        target.outputs.push({
            type: 'OUTPUT_BLOCK',
            file: fileValue,
            overrides: overrides as any,
            line: token.line,
            column: token.column,
            length: (endToken.column + endToken.length) - token.column,
        });
        return j;
    }
}
