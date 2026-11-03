import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/**
 * Parses: `crop 1280x720` or `crop 1280x720 100 50` (optional x y offsets).
 * Without offsets, FFmpeg centers the crop.
 */
export class CropParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const sizeTok = this.tokens[i + 1];

        if (sizeTok === undefined) {
            throw new CompilerError('Crop size is required', token.line, token.column, token.length);
        }
        if (sizeTok.type !== 'RESOLUTION') {
            throw new CompilerError(
                "Crop size must be WIDTHxHEIGHT, e.g. '1280x720'",
                sizeTok.line,
                sizeTok.column,
                sizeTok.length,
            );
        }

        const [wStr, hStr] = sizeTok.value.split('x');
        const width = parseInt(wStr!, 10);
        const height = parseInt(hStr!, 10);
        let consumed = i + 1;
        let x: number | undefined;
        let y: number | undefined;

        const xTok = this.tokens[i + 2];
        const yTok = this.tokens[i + 3];
        if (xTok?.type === 'NUMBER' && yTok?.type === 'NUMBER') {
            x = parseInt(xTok.value, 10);
            y = parseInt(yTok.value, 10);
            consumed = i + 3;
        }

        target.crop = {
            type: 'CROP',
            width,
            height,
            ...(x !== undefined ? { x } : {}),
            ...(y !== undefined ? { y } : {}),
            line: token.line,
            column: token.column,
            length: (this.tokens[consumed]!.column + this.tokens[consumed]!.length) - token.column,
        };
        return consumed;
    }
}
