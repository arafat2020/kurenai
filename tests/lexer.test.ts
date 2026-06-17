import { describe, it, expect } from 'vitest';
import { lexer } from '../src/lexer.js';

describe('Lexer Tests', () => {
  it('should recognize keywords and resolutions', () => {
    const result = lexer('resize 1920x1080');
    expect(result).toEqual([
      { type: 'KEYWORD', value: 'resize', line: 1, column: 1, length: 6 },
      { type: 'RESOLUTION', value: '1920x1080', line: 1, column: 8, length: 9 }
    ]);
  });

  it('should recognize identifiers with hyphens', () => {
    const result = lexer('bottom-right');
    expect(result).toEqual([
      { type: 'IDENTIFIER', value: 'bottom-right', line: 1, column: 1, length: 12 }
    ]);
  });

  it('should recognize keywords and numbers', () => {
    const result = lexer('fps 30');
    expect(result).toEqual([
      { type: 'KEYWORD', value: 'fps', line: 1, column: 1, length: 3 },
      { type: 'NUMBER', value: '30', line: 1, column: 5, length: 2 }
    ]);
  });

  it('should recognize strings', () => {
    const result = lexer('output "video.mp4"');
    expect(result).toEqual([
      { type: 'KEYWORD', value: 'output', line: 1, column: 1, length: 6 },
      { type: 'STRING', value: '"video.mp4"', line: 1, column: 8, length: 11 }
    ]);
  });

  it('should handle multiple lines', () => {
    const result = lexer('resize 1920x1080\nfps 30');
    expect(result).toEqual([
      { type: 'KEYWORD', value: 'resize', line: 1, column: 1, length: 6 },
      { type: 'RESOLUTION', value: '1920x1080', line: 1, column: 8, length: 9 },
      { type: 'KEYWORD', value: 'fps', line: 2, column: 1, length: 3 },
      { type: 'NUMBER', value: '30', line: 2, column: 5, length: 2 }
    ]);
  });

  it('should recognize resolutions', () => {
    const result = lexer('1280x720');
    expect(result).toEqual([
      { type: 'RESOLUTION', value: '1280x720', line: 1, column: 1, length: 8 }
    ]);
  });

  it('should recognize all keywords', () => {
    const result = lexer('resize input fps output encode bitrate audio watermark thumbnail');
    expect(result).toHaveLength(9);
    expect(result.every((t: any) => t.type === 'KEYWORD')).toBe(true);
  });

  it('should recognize multiple hyphenated identifiers', () => {
    const result = lexer('top-left middle-center bottom-right');
    expect(result).toEqual([
      { type: 'IDENTIFIER', value: 'top-left', line: 1, column: 1, length: 8 },
      { type: 'IDENTIFIER', value: 'middle-center', line: 1, column: 10, length: 13 },
      { type: 'IDENTIFIER', value: 'bottom-right', line: 1, column: 24, length: 12 }
    ]);
  });

  it('should skip empty lines', () => {
    const result = lexer('resize 1920x1080\n\nfps 30');
    expect(result).toEqual([
      { type: 'KEYWORD', value: 'resize', line: 1, column: 1, length: 6 },
      { type: 'RESOLUTION', value: '1920x1080', line: 1, column: 8, length: 9 },
      { type: 'KEYWORD', value: 'fps', line: 3, column: 1, length: 3 },
      { type: 'NUMBER', value: '30', line: 3, column: 5, length: 2 }
    ]);
  });

  it('should recognize bitrate values', () => {
    const result = lexer('bitrate 3000k');
    expect(result).toEqual([
      { type: 'KEYWORD', value: 'bitrate', line: 1, column: 1, length: 7 },
      { type: 'BITRATE', value: '3000k', line: 1, column: 9, length: 5 }
    ]);
  });

  it('should recognize time values', () => {
    const result = lexer('thumbnail 5s');
    expect(result).toEqual([
      { type: 'KEYWORD', value: 'thumbnail', line: 1, column: 1, length: 9 },
      { type: 'TIME', value: '5s', line: 1, column: 11, length: 2 }
    ]);
  });
});
