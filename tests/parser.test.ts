import { describe, it, expect } from 'vitest';
import { lexer } from '../src/lexer.js';
import { parseTokens } from '../src/parser.js';

describe('Parser Tests', () => {
  it('should parse input and output keywords', () => {
    const tokens = lexer('input "test.mp4" output "result.mp4"');
    const ast = parseTokens(tokens);
    expect(ast.input).toEqual({ type: 'INPUT', value: 'test.mp4', line: 1, column: 7, length: 10 });
    expect(ast.outputs[0]).toEqual({ type: 'OUTPUT_BLOCK', file: 'result.mp4', overrides: {}, line: 1, column: 18, length: 19 });
  });

  it('should parse resize with 1920x1080', () => {
    const tokens = lexer('resize 1920x1080');
    const ast = parseTokens(tokens);
    expect(ast.resize).toEqual({ type: 'RESIZE', width: 1920, height: 1080, line: 1, column: 8, length: 9 });
  });

  it('should parse fps with value 60', () => {
    const tokens = lexer('fps 60');
    const ast = parseTokens(tokens);
    expect(ast.fps).toEqual({ type: 'FPS', value: 60, line: 1, column: 5, length: 2 });
  });

  it('should parse bitrate with 5000k', () => {
    const tokens = lexer('bitrate 5000k');
    const ast = parseTokens(tokens);
    expect(ast.bitrate).toEqual({ type: 'BITRATE', value: '5000k', line: 1, column: 9, length: 5 });
  });

  it('should parse encode with h265 and mp3', () => {
    const tokens = lexer('encode h265 mp3');
    const ast = parseTokens(tokens);
    expect(ast.encode).toEqual({ type: 'ENCODE', videoCodec: 'h265', audioCodec: 'mp3', line: 1, column: 1, length: 15 });
  });

  it('should parse watermark with top-left position', () => {
    const tokens = lexer('watermark "logo.png" top-left');
    const ast = parseTokens(tokens);
    expect(ast.watermark).toEqual({ type: 'WATERMARK', file: 'logo.png', position: 'top-left', line: 1, column: 1, length: 29 });
  });

  it('should parse thumbnail with 10s', () => {
    const tokens = lexer('thumbnail 10s');
    const ast = parseTokens(tokens);
    expect(ast.thumbnail).toEqual({ type: 'THUMBNAIL', value: '10s', line: 1, column: 11, length: 3 });
  });

  it('should parse audio with identifier', () => {
    const tokens = lexer('audio soundtrack');
    const ast = parseTokens(tokens);
    expect(ast.audio).toEqual({ type: 'AUDIO', value: 'soundtrack', line: 1, column: 7, length: 10 });
  });

  it('should parse audio with string literal path', () => {
    const tokens = lexer('audio "soundtrack.mp3"');
    const ast = parseTokens(tokens);
    expect(ast.audio).toEqual({ type: 'AUDIO', value: 'soundtrack.mp3', line: 1, column: 7, length: 16 });
  });

  it('should parse audio block with multiple properties', () => {
    const src = `audio {
      file "bg.mp3"
      codec aac
      bitrate 192k
      samplerate 44100
      channels stereo
      reverb medium
      fadein 1s
      fadeout 500ms
      normalize -14 lufs
    }`;
    const tokens = lexer(src);
    const ast = parseTokens(tokens);
    expect(ast.audio).toEqual({
      type: 'AUDIO',
      value: 'bg.mp3',
      codec: 'aac',
      bitrate: '192k',
      samplerate: 44100,
      channels: 'stereo',
      reverb: 'medium',
      fadein: '1s',
      fadeout: '500ms',
      normalize: {
        type: 'NORMALIZE',
        value: -14,
        unit: 'lufs',
        line: 10,
        column: 7,
        length: 18
      },
      line: 1,
      column: 1,
      length: 5
    });
  });

  it('should parse audio block with eq settings', () => {
    const src = `audio {
      file "music.wav"
      eq {
        bass 5db
        mid -2db
        treble 1db
      }
    }`;
    const tokens = lexer(src);
    const ast = parseTokens(tokens);
    expect(ast.audio?.eq).toEqual({
      type: 'EQ',
      bass: 5,
      mid: -2,
      treble: 1,
      line: 3,
      column: 7,
      length: 1
    });
  });

  it('should parse audio block with compression settings', () => {
    const src = `audio {
      file "voice.wav"
      compress {
        threshold -20db
        ratio 4:1
        attack 15ms
        release 200ms
      }
    }`;
    const tokens = lexer(src);
    const ast = parseTokens(tokens);
    expect(ast.audio?.compress).toEqual({
      type: 'COMPRESSION',
      threshold: -20,
      ratio: 4,
      attack: 15,
      release: 200,
      line: 3,
      column: 7,
      length: 1
    });
  });

  it('should throw errors for invalid audio block properties and nested configurations', () => {
    // Unsupported property
    expect(() => parseTokens(lexer('audio { unknownProp 123 }'))).toThrow(/Unknown audio property "unknownProp"/);
    // Missing value for property
    expect(() => parseTokens(lexer('audio { file }'))).toThrow(/Value required for audio property "file"/);
    // Invalid channels value
    expect(() => parseTokens(lexer('audio { channels surround }'))).toThrow(/Audio channels must be 'stereo' or 'mono'/);
    // Invalid reverb value
    expect(() => parseTokens(lexer('audio { reverb heavy }'))).toThrow(/Unsupported reverb type/);
    // Invalid normalize unit
    expect(() => parseTokens(lexer('audio { normalize -12 db }'))).toThrow(/Unsupported normalize unit/);
    // Unclosed eq block
    expect(() => parseTokens(lexer('audio { eq { bass 3db'))).toThrow(/Expected } at the end of eq block/);
    // Invalid eq property
    expect(() => parseTokens(lexer('audio { eq { bass 3db unknown 2db } }'))).toThrow(/Unknown eq property "unknown"/);
    // EQ value not in dB format
    expect(() => parseTokens(lexer('audio { eq { bass 3 } }'))).toThrow(/EQ value must be in dB format/);
    // Compress threshold not in dB format
    expect(() => parseTokens(lexer('audio { compress { threshold -20 } }'))).toThrow(/Compression threshold must be in dB format/);
    // Invalid compress ratio
    expect(() => parseTokens(lexer('audio { compress { ratio invalid } }'))).toThrow(/Compression ratio must be/);
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
    expect(ast.outputs[0]?.file).toBe('final.mp4');
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
    expect(ast.profiles['testProfile']?.body.resize).toEqual({ type: 'RESIZE', width: 1920, height: 1080, line: 1, column: 30, length: 9 });
    expect(ast.profiles['testProfile']?.body.fps).toEqual({ type: 'FPS', value: 60, line: 1, column: 44, length: 2 });
  });

  it('should apply a profile using use', () => {
    const tokens = lexer('profile p1 { fps 30 } use p1');
    const ast = parseTokens(tokens);
    expect(ast.fps).toEqual({ type: 'FPS', value: 30, line: 1, column: 18, length: 2 });
  });

  it('should give inline configuration precedence over used profiles', () => {
    const tokens = lexer('profile p1 { fps 30 resize 1920x1080 } use p1 fps 60');
    const ast = parseTokens(tokens);
    // Inline fps 60 should overwrite profile's fps 30
    expect(ast.fps).toEqual({ type: 'FPS', value: 60, line: 1, column: 51, length: 2 });
    // But resize from profile should still be applied
    expect(ast.resize).toEqual({ type: 'RESIZE', width: 1920, height: 1080, line: 1, column: 28, length: 9 });
  });

  it('should give inline configuration precedence even if use is called after', () => {
    const tokens = lexer('profile p1 { fps 30 } fps 60 use p1');
    const ast = parseTokens(tokens);
    // Inline fps 60 should be preserved, use p1 should not overwrite it
    expect(ast.fps).toEqual({ type: 'FPS', value: 60, line: 1, column: 27, length: 2 });
  });

  it('should throw an error if using an undefined profile', () => {
    const tokens = lexer('use notFoundProfile');
    expect(() => parseTokens(tokens)).toThrow(/not found/);
  });

  it('should parse multiple outputs with override blocks', () => {
    const src = `input "video.mp4"
output "youtube.mp4" { resize 1920x1080 }
output "mobile.mp4" { resize 720x1280 }`;
    const tokens = lexer(src);
    const ast = parseTokens(tokens);

    expect(ast.outputs.length).toBe(2);
    expect(ast.outputs[0]?.file).toBe('youtube.mp4');
    expect(ast.outputs[0]?.overrides.resize?.width).toBe(1920);
    expect(ast.outputs[0]?.overrides.resize?.height).toBe(1080);
    
    expect(ast.outputs[1]?.file).toBe('mobile.mp4');
    expect(ast.outputs[1]?.overrides.resize?.width).toBe(720);
    expect(ast.outputs[1]?.overrides.resize?.height).toBe(1280);
  });
});
