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

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal Program skeleton used for audio codegen tests */
function makeProgram(audio: Program['audio']): Program {
    return {
        type: 'PROGRAM',
        line: 1, column: 1, length: 0,
        input:   { type: 'INPUT',        value: 'in.mp4', line: 1, column: 1, length: 6 },
        outputs: [{ type: 'OUTPUT_BLOCK', file: 'out.mp4', overrides: {}, line: 1, column: 1, length: 7 }],
        profiles: {},
        audio,
    } as Program;
}

describe('Audio Codegen Tests', () => {
    // 1 ── codec only ──────────────────────────────────────────────────────────
    it('should emit -c:a for audio.codec', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            codec: 'aac',
        }));
        expect(cmds[0]).toBe('ffmpeg -i in.mp4 -c:a aac out.mp4');
    });

    // 2 ── bitrate, samplerate, channels ──────────────────────────────────────
    it('should emit -b:a, -ar, -ac flags for bitrate/samplerate/channels', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            codec: 'aac',
            bitrate: '192k',
            samplerate: 48000,
            channels: 'stereo',
        }));
        expect(cmds[0]).toBe('ffmpeg -i in.mp4 -c:a aac -b:a 192k -ar 48000 -ac 2 out.mp4');
    });

    it('should emit -ac 1 for mono channels', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            channels: 'mono',
        }));
        expect(cmds[0]).toContain('-ac 1');
    });

    // 3 ── external file mixing ────────────────────────────────────────────────
    it('should add -i and amix filter for audio.value (external file)', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            value: 'bg.mp3',
        }));
        expect(cmds[0]).toContain('-i bg.mp3');
        expect(cmds[0]).toContain('amix=inputs=2:duration=first');
    });

    // 4 ── normalization ───────────────────────────────────────────────────────
    it('should emit loudnorm=I= for lufs normalization', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            normalize: { type: 'NORMALIZE', value: -14, unit: 'lufs', line: 1, column: 1, length: 0 },
        }));
        expect(cmds[0]).toContain('-af "loudnorm=I=-14"');
    });

    it('should emit loudnorm=TP= for dbtp normalization', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            normalize: { type: 'NORMALIZE', value: -1, unit: 'dbtp', line: 1, column: 1, length: 0 },
        }));
        expect(cmds[0]).toContain('-af "loudnorm=TP=-1"');
    });

    it('should emit loudnorm=LRA= for dbrms normalization', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            normalize: { type: 'NORMALIZE', value: 7, unit: 'dbrms', line: 1, column: 1, length: 0 },
        }));
        expect(cmds[0]).toContain('-af "loudnorm=LRA=7"');
    });

    // 5 ── EQ ──────────────────────────────────────────────────────────────────
    it('should emit equalizer filters for eq bass/mid/treble', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            eq: { type: 'EQ', bass: 3, mid: -1, treble: 2, line: 1, column: 1, length: 0 },
        }));
        const cmd = cmds[0]!;
        expect(cmd).toContain('equalizer=f=100:width_type=o:width=2:g=3');
        expect(cmd).toContain('equalizer=f=1000:width_type=o:width=2:g=-1');
        expect(cmd).toContain('equalizer=f=10000:width_type=o:width=2:g=2');
    });

    it('should only emit defined eq bands (partial eq block)', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            eq: { type: 'EQ', bass: 5, line: 1, column: 1, length: 0 },
        }));
        const cmd = cmds[0]!;
        expect(cmd).toContain('equalizer=f=100:width_type=o:width=2:g=5');
        expect(cmd).not.toContain('equalizer=f=1000');
        expect(cmd).not.toContain('equalizer=f=10000');
    });

    // 6 ── Compression ─────────────────────────────────────────────────────────
    it('should emit acompressor with all four params', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            compress: { type: 'COMPRESSION', threshold: -18, ratio: 4, attack: 5, release: 100, line: 1, column: 1, length: 0 },
        }));
        expect(cmds[0]).toContain('acompressor=threshold=-18dB:ratio=4:attack=5:release=100');
    });

    it('should emit acompressor with only provided compress params', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            compress: { type: 'COMPRESSION', ratio: 4, line: 1, column: 1, length: 0 },
        }));
        const cmd = cmds[0]!;
        expect(cmd).toContain('acompressor=ratio=4');
        expect(cmd).not.toContain('threshold');
        expect(cmd).not.toContain('attack');
        expect(cmd).not.toContain('release');
    });

    // 7 ── Reverb ─────────────────────────────────────────────────────────────
    it('should emit aecho for subtle reverb', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            reverb: 'subtle',
        }));
        expect(cmds[0]).toContain('aecho=0.8:0.8:20:0.1');
    });

    it('should emit aecho for medium reverb', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            reverb: 'medium',
        }));
        expect(cmds[0]).toContain('aecho=0.8:0.8:60:0.3');
    });

    it('should emit aecho for large reverb', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            reverb: 'large',
        }));
        expect(cmds[0]).toContain('aecho=0.8:0.8:120:0.5');
    });

    // 8 ── Fade ────────────────────────────────────────────────────────────────
    it('should emit afade=t=in for fadein', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            fadein: '2s',
        }));
        expect(cmds[0]).toContain('afade=t=in:st=0:d=2');
    });

    it('should emit afade=t=out for fadeout', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            fadeout: '3s',
        }));
        expect(cmds[0]).toContain('afade=t=out:st=99999:d=3');
    });

    it('should emit afade for millisecond fade values (500ms)', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            fadein: '500ms',
        }));
        expect(cmds[0]).toContain('afade=t=in:st=0:d=500');
    });

    // 9 ── Full audio.crn equivalent ───────────────────────────────────────────
    it('should generate the full audio pipeline matching audio.crn output', () => {
        const cmds = generate(makeProgram({
            type: 'AUDIO', line: 1, column: 1, length: 0,
            codec:      'aac',
            bitrate:    '192k',
            samplerate: 48000,
            channels:   'stereo',
            normalize:  { type: 'NORMALIZE', value: -14, unit: 'lufs', line: 1, column: 1, length: 0 },
            eq:         { type: 'EQ', bass: 3, mid: -1, treble: 2, line: 1, column: 1, length: 0 },
            compress:   { type: 'COMPRESSION', threshold: -18, ratio: 4, attack: 5, release: 100, line: 1, column: 1, length: 0 },
            reverb:     'subtle',
            fadein:     '2s',
            fadeout:    '3s',
        }));
        expect(cmds[0]).toBe(
            'ffmpeg -i in.mp4' +
            ' -c:a aac -b:a 192k -ar 48000 -ac 2' +
            ' -af "loudnorm=I=-14' +
            ',equalizer=f=100:width_type=o:width=2:g=3' +
            ',equalizer=f=1000:width_type=o:width=2:g=-1' +
            ',equalizer=f=10000:width_type=o:width=2:g=2' +
            ',acompressor=threshold=-18dB:ratio=4:attack=5:release=100' +
            ',aecho=0.8:0.8:20:0.1' +
            ',afade=t=in:st=0:d=2' +
            ',afade=t=out:st=99999:d=3"' +
            ' out.mp4'
        );
    });
});
