import { describe, it, expect } from 'vitest';
import { lexer } from '../src/lexer.js';
import { parseTokens } from '../src/parser.js';

describe('Parser Tests', () => {
  it('should parse input and output keywords', () => {
    const tokens = lexer('input "test.mp4" output "result.mp4"');
    const ast = parseTokens(tokens);
    expect(ast.input).toEqual({ type: 'INPUT', value: 'test.mp4', line: 1 });
    expect(ast.output).toEqual({ type: 'OUTPUT', value: 'result.mp4', line: 1 });
  });

  it('should parse resize with 1920x1080', () => {
    const tokens = lexer('resize 1920x1080');
    const ast = parseTokens(tokens);
    expect(ast.resize).toEqual({ type: 'RESIZE', width: 1920, height: 1080, line: 1 });
  });

  it('should parse fps with value 60', () => {
    const tokens = lexer('fps 60');
    const ast = parseTokens(tokens);
    expect(ast.fps).toEqual({ type: 'FPS', value: 60, line: 1 });
  });

  it('should parse bitrate with 5000k', () => {
    const tokens = lexer('bitrate 5000k');
    const ast = parseTokens(tokens);
    expect(ast.bitrate).toEqual({ type: 'BITRATE', value: '5000k', line: 1 });
  });

  it('should parse encode with h265 and mp3', () => {
    const tokens = lexer('encode h265 mp3');
    const ast = parseTokens(tokens);
    expect(ast.encode).toEqual({ type: 'ENCODE', videoCodec: 'h265', audioCodec: 'mp3', line: 1 });
  });

  it('should parse watermark with top-left position', () => {
    const tokens = lexer('watermark "logo.png" top-left');
    const ast = parseTokens(tokens);
    expect(ast.watermark).toEqual({ type: 'WATERMARK', file: 'logo.png', position: 'top-left', line: 1 });
  });

  it('should parse thumbnail with 10s', () => {
    const tokens = lexer('thumbnail 10s');
    const ast = parseTokens(tokens);
    expect(ast.thumbnail).toEqual({ type: 'THUMBNAIL', value: '10s', line: 1 });
  });

  it('should parse audio with identifier', () => {
    const tokens = lexer('audio soundtrack');
    const ast = parseTokens(tokens);
    expect(ast.audio).toEqual({ type: 'AUDIO', value: 'soundtrack', line: 1 });
  });

  it('should parse complete program with all features', () => {
    const src = `input "video.mp4"
resize 1280x720
fps 30
encode h264 aac
bitrate 3000k
watermark "logo.png" bottom-right
thumbnail 5s
output "final.mp4"`;
    const tokens = lexer(src);
    const ast = parseTokens(tokens);
    
    expect(ast.input?.value).toBe('video.mp4');
    expect(ast.resize?.width).toBe(1280);
    expect(ast.resize?.height).toBe(720);
    expect(ast.fps?.value).toBe(30);
    expect(ast.encode?.videoCodec).toBe('h264');
    expect(ast.bitrate?.value).toBe('3000k');
    expect(ast.watermark?.file).toBe('logo.png');
    expect(ast.thumbnail?.value).toBe('5s');
    expect(ast.output?.value).toBe('final.mp4');
  });

  it('should throw error for missing input value', () => {
    const tokens = lexer('input output');
    expect(() => parseTokens(tokens)).toThrow(/File source is required/);
  });

  it('should throw error for invalid resize format', () => {
    const tokens = lexer('resize invalid');
    expect(() => parseTokens(tokens)).toThrow(/Resolution/);
  });

  it('should throw error for fps without value', () => {
    const tokens = lexer('fps');
    expect(() => parseTokens(tokens)).toThrow(/FPS/);
  });

  it('should throw error for invalid bitrate type', () => {
    const tokens = lexer('bitrate 500');
    expect(() => parseTokens(tokens)).toThrow(/Bitrate/);
  });

  it('should throw error for unknown keyword', () => {
    const tokens = lexer('unknown-keyword test');
    expect(() => parseTokens(tokens)).toThrow(/Unexpected token/);
  });

  it('should parse bitrate with m unit', () => {
    const tokens = lexer('bitrate 2m');
    const ast = parseTokens(tokens);
    expect(ast.bitrate?.value).toBe('2m');
  });

  it('should parse a profile definition', () => {
    const tokens = lexer('profile testProfile { resize 1920x1080 fps 60 }');
    const ast = parseTokens(tokens);
    expect(ast.profiles['testProfile']).toBeDefined();
    expect(ast.profiles['testProfile']?.name).toBe('testProfile');
    expect(ast.profiles['testProfile']?.body.resize).toEqual({ type: 'RESIZE', width: 1920, height: 1080, line: 1 });
    expect(ast.profiles['testProfile']?.body.fps).toEqual({ type: 'FPS', value: 60, line: 1 });
  });

  it('should apply a profile using use', () => {
    const tokens = lexer('profile p1 { fps 30 } use p1');
    const ast = parseTokens(tokens);
    expect(ast.fps).toEqual({ type: 'FPS', value: 30, line: 1 });
  });

  it('should give inline configuration precedence over used profiles', () => {
    const tokens = lexer('profile p1 { fps 30 resize 1920x1080 } use p1 fps 60');
    const ast = parseTokens(tokens);
    // Inline fps 60 should overwrite profile's fps 30
    expect(ast.fps).toEqual({ type: 'FPS', value: 60, line: 1 });
    // But resize from profile should still be applied
    expect(ast.resize).toEqual({ type: 'RESIZE', width: 1920, height: 1080, line: 1 });
  });

  it('should give inline configuration precedence even if use is called after', () => {
    const tokens = lexer('profile p1 { fps 30 } fps 60 use p1');
    const ast = parseTokens(tokens);
    // Inline fps 60 should be preserved, use p1 should not overwrite it
    expect(ast.fps).toEqual({ type: 'FPS', value: 60, line: 1 });
  });

  it('should throw an error if using an undefined profile', () => {
    const tokens = lexer('use notFoundProfile');
    expect(() => parseTokens(tokens)).toThrow(/not found/);
  });
});
