import { describe, it, expect } from 'vitest';
import { generate } from '../src/codegen.js';
import { ProgramV2 } from '../src/interfaces/v2.js';

describe('Codegen V2 Tests', () => {
    const createBaseV2Program = (overrides?: Partial<ProgramV2>): ProgramV2 => {
        return {
            type: 'PROGRAM',
            version: 2,
            line: 1,
            column: 1,
            length: 0,
            sources: {
                intro: { type: 'SOURCE', name: 'intro', file: 'intro.mp4', line: 1, column: 1, length: 0 }
            },
            clips: {
                c_intro: { type: 'CLIP', name: 'c_intro', sourceName: 'intro', start: '0s', end: '10s', line: 1, column: 1, length: 0 }
            },
            mixes: {},
            timeline: { type: 'TIMELINE', clips: ['c_intro'], line: 1, column: 1, length: 0 },
            outputs: [{ type: 'OUTPUT_BLOCK', file: 'final.mp4', overrides: {}, line: 1, column: 1, length: 0 }],
            profiles: {},
            ...overrides
        } as ProgramV2;
    };

    it('should generate commands for basic clip rendering and concatenation', () => {
        const prog = createBaseV2Program();
        const cmds = generate(prog);

        expect(cmds.length).toBe(3);
        expect(cmds[0]).toBe('ffmpeg -ss 0 -to 10 -i intro.mp4 segment_c_intro.mp4');
        expect(cmds[1]).toBe('# Write to segments.txt:\nfile segment_c_intro.mp4');
        expect(cmds[2]).toBe('ffmpeg -f concat -safe 0 -i segments.txt -c copy final.mp4');
    });

    it('should apply global filters and encode options to Pass 1 clip commands', () => {
        const prog = createBaseV2Program({
            resize: { type: 'RESIZE', width: 1280, height: 720, line: 1, column: 1, length: 0 },
            fps: { type: 'FPS', value: 30, line: 1, column: 1, length: 0 },
            encode: { type: 'ENCODE', videoCodec: 'h264' as any, audioCodec: 'aac' as any, line: 1, column: 1, length: 0 },
            bitrate: { type: 'BITRATE', value: '2M', line: 1, column: 1, length: 0 },
            watermark: { type: 'WATERMARK', file: 'logo.png', position: 'top-left' as any, line: 1, column: 1, length: 0 }
        });
        const cmds = generate(prog);

        expect(cmds[0]).toBe('ffmpeg -ss 0 -to 10 -i intro.mp4 -i logo.png -vf "scale=1280:720,fps=30" -c:v libx264 -c:a aac -b:v 2M -filter_complex "overlay=10:10" segment_c_intro.mp4');
    });

    it('should generate complex filter for audio volume mixing in Pass 2', () => {
        const prog = createBaseV2Program({
            sources: {
                intro: { type: 'SOURCE', name: 'intro', file: 'intro.mp4', line: 1, column: 1, length: 0 },
                music: { type: 'SOURCE', name: 'music', file: 'bg.mp3', line: 1, column: 1, length: 0 },
                voice: { type: 'SOURCE', name: 'voice', file: 'voice.wav', line: 1, column: 1, length: 0 }
            },
            mixes: {
                bg: {
                    type: 'MIX',
                    name: 'bg',
                    tracks: [
                        { type: 'TRACK', sourceName: 'music', volume: 0.3, line: 1, column: 1, length: 0 },
                        { type: 'TRACK', sourceName: 'voice', volume: 1.0, line: 1, column: 1, length: 0 }
                    ],
                    line: 1, column: 1, length: 0
                }
            },
            audio: { type: 'AUDIO', value: 'bg', line: 1, column: 1, length: 0 }
        });
        const cmds = generate(prog);

        expect(cmds[2]).toBe('ffmpeg -f concat -safe 0 -i segments.txt -i bg.mp3 -i voice.wav -filter_complex "[1:a]volume=0.3[music];[2:a]volume=1[voice];[music][voice]amix=inputs=2:duration=longest[aout]" -map 0:v -c:v copy -map [aout] -c:a aac final.mp4');
    });
});
