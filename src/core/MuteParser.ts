import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/** Parses: `mute` (strip audio / -an) */
export class MuteParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        target.mute = {
            type: 'MUTE',
            line: token.line,
            column: token.column,
            length: token.length,
        };
        return i;
    }
}
