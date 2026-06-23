import { describe, it, expect } from 'vitest';
import { generate } from '../src/codegen.js';
import { Program, VideoCodec, AudioCodec, WatermarkPosition } from '../src/parser.js';

describe('Codegen Tests', () => {
    it('should generate basic ffmpeg command with input and output', () => {
        const ast: Program = {
            type: 'PROGRAM',
            line: 1,
            input: { type: 'INPUT', value: 'in.mp4', line: 1 },
            outputs: [{ type: 'OUTPUT_BLOCK', file: 'out.mp4', overrides: {}, line: 1 }],
            profiles: {}
        };
        const cmds = generate(ast);
        expect(cmds.length).toBe(1);
        expect(cmds[0]).toBe('ffmpeg -i in.mp4 out.mp4');
    });

    it('should generate complex pipeline with filters and codecs', () => {
        const ast: Program = {
            type: 'PROGRAM',
            line: 1,
            input: { type: 'INPUT', value: 'in.mp4', line: 1 },
            outputs: [{ type: 'OUTPUT_BLOCK', file: 'out.mp4', overrides: {}, line: 1 }],
            resize: { type: 'RESIZE', width: 1280, height: 720, line: 1 },
            fps: { type: 'FPS', value: 30, line: 1 },
            encode: { type: 'ENCODE', videoCodec: VideoCodec.H264, audioCodec: AudioCodec.AAC, line: 1 },
            bitrate: { type: 'BITRATE', value: '2M', line: 1 },
            profiles: {}
        };
        const cmds = generate(ast);
        expect(cmds[0]).toBe('ffmpeg -i in.mp4 -vf "scale=1280:720,fps=30" -c:v libx264 -c:a aac -b:v 2M out.mp4');
    });

    it('should correctly handle watermarks and multiple commands (thumbnail)', () => {
        const ast: Program = {
            type: 'PROGRAM',
            line: 1,
            input: { type: 'INPUT', value: 'in.mp4', line: 1 },
            outputs: [{ type: 'OUTPUT_BLOCK', file: 'out.mp4', overrides: {}, line: 1 }],
            watermark: { type: 'WATERMARK', file: 'logo.png', position: WatermarkPosition.TOP_LEFT, line: 1 },
            thumbnail: { type: 'THUMBNAIL', value: '15s', line: 1 },
            profiles: {}
        };
        const cmds = generate(ast);
        expect(cmds.length).toBe(2);
        expect(cmds[0]).toBe('ffmpeg -i in.mp4 -i logo.png -filter_complex "overlay=10:10" out.mp4');
        expect(cmds[1]).toBe('ffmpeg -i in.mp4 -ss 15 -frames:v 1 thumb.jpg');
    });

    it('should generate separate commands for multiple outputs with overrides', () => {
        const ast: Program = {
            type: 'PROGRAM',
            line: 1,
            input: { type: 'INPUT', value: 'video.mp4', line: 1 },
            outputs: [
                { 
                    type: 'OUTPUT_BLOCK', 
                    file: 'youtube.mp4', 
                    overrides: { resize: { type: 'RESIZE', width: 1920, height: 1080, line: 1 } }, 
                    line: 2 
                },
                { 
                    type: 'OUTPUT_BLOCK', 
                    file: 'mobile.mp4', 
                    overrides: { resize: { type: 'RESIZE', width: 720, height: 1280, line: 1 } }, 
                    line: 3 
                }
            ],
            profiles: {}
        };
        const cmds = generate(ast);
        expect(cmds.length).toBe(2);
        expect(cmds[0]).toBe('ffmpeg -i video.mp4 -vf "scale=1920:1080" youtube.mp4');
        expect(cmds[1]).toBe('ffmpeg -i video.mp4 -vf "scale=720:1280" mobile.mp4');
    });
});
