import { describe, it, expect, vi } from 'vitest';
import { explain } from '../src/explain.js';
import { Program, VideoCodec, AudioCodec } from '../src/parser.js';

describe('Explain Tests', () => {
    it('should log expected output to console', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const ast: Program = {
            type: 'PROGRAM',
            line: 1,
            input: { type: 'INPUT', value: 'in.mp4', line: 1 },
            output: { type: 'OUTPUT', value: 'out.mp4', line: 1 },
            encode: { type: 'ENCODE', videoCodec: VideoCodec.H264, audioCodec: AudioCodec.AAC, line: 1 },
            profiles: {}
        };
        
        explain(ast, ['ffmpeg -i in.mp4 -c:v libx264 -c:a aac out.mp4']);
        
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Input:    in.mp4'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Output:   out.mp4'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Encoding:'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('video codec: h264 → libx264'));
        
        logSpy.mockRestore();
    });

    it('should display profiles when they exist', () => {
        const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
        const ast: Program = {
            type: 'PROGRAM',
            line: 1,
            input: { type: 'INPUT', value: 'in.mp4', line: 1 },
            output: { type: 'OUTPUT', value: 'out.mp4', line: 1 },
            profiles: {
                'hd1080': {
                    type: 'PROFILE',
                    name: 'hd1080',
                    line: 1,
                    body: {}
                }
            }
        };
        
        explain(ast, []);
        
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Profiles:'));
        expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('defined profile: hd1080'));
        
        logSpy.mockRestore();
    });
});
