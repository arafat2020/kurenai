import { CompilerError } from '../errors.js';
import { type Program } from '../interfaces/parser.js';
import { BaseParser } from './BaseParser.js';

/**
 * Parses: `use PROFILE_NAME`
 *
 * Merges all properties from the named profile body into the current target
 * without overwriting properties that are already set (profiles are defaults).
 */
export class UseParser extends BaseParser {
    parse(i: number, target: Partial<Program>): number {
        const token = this.tokens[i]!;
        const nameToken = this.tokens[i + 1];

        if (!nameToken || nameToken.type !== 'IDENTIFIER') {
            throw new CompilerError('Profile name is required for use', token.line, token.column, token.length);
        }

        const profileName = nameToken.value;
        const profile = this.program.profiles?.[profileName];

        if (!profile) {
            throw new CompilerError(`Profile "${profileName}" not found at line ${token.line}`, nameToken.line, nameToken.column, nameToken.length);
        }

        // Only copy profile properties that aren't already set on the target
        for (const [key, value] of Object.entries(profile.body)) {
            if (!(key in target)) {
                (target as any)[key] = value;
            }
        }
        return i + 1;
    }
}
