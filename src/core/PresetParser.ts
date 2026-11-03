import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

const VALID_PRESETS = new Set([
    'ultrafast',
    'superfast',
    'veryfast',
    'faster',
    'fast',
    'medium',
    'slow',
    'slower',
    'veryslow',
    'placebo',
]);

/** Parses: `preset medium` */
export class PresetParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const next = this.tokens[i + 1];

        if (next === undefined) {
            throw new CompilerError('Preset value is required', token.line, token.column, token.length);
        }
        if (next.type !== 'IDENTIFIER') {
            throw new CompilerError(
                "Preset must be an identifier, e.g. 'preset medium'",
                next.line,
                next.column,
                next.length,
            );
        }
        if (!VALID_PRESETS.has(next.value)) {
            throw new CompilerError(
                `Unknown preset "${next.value}". Valid: ${[...VALID_PRESETS].join(', ')}`,
                next.line,
                next.column,
                next.length,
            );
        }

        target.preset = {
            type: 'PRESET',
            value: next.value,
            line: next.line,
            column: next.column,
            length: next.length,
        };
        return i + 1;
    }
}
