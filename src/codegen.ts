import { Program } from "./parser";
import { type CompileOptions } from "./index.js";

/**
 * Maps simple Kurenai video codec names to their FFmpeg equivalents.
 */
export const videoCodecMap: Record<string, string> = {
    h264: 'libx264',
    h265: 'libx265',
    vp8: 'libvpx',
    vp9: 'libvpx-vp9',
    av1: 'libaom-av1',
    mpeg2video: 'mpeg2video',
    theora: 'libtheora'
};

/**
 * Maps Kurenai watermark position names to FFmpeg overlay coordinates.
 * These expressions calculate the exact X:Y placement dynamically.
 */
const positionMap: Record<string, string> = {
    'top-left': '10:10',
    'top-right': 'main_w-overlay_w-10:10',
    'bottom-left': '10:main_h-overlay_h-10',
    'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10',
    'center': '(main_w-overlay_w)/2:(main_h-overlay_h)/2'
};

import { generateV2 } from "./codegen-v2.js";
import { type ProgramV2 } from "./interfaces/v2.js";

/**
 * Translates the validated Program AST into an array of executable FFmpeg commands.
 * It builds the main ffmpeg pipeline and adds extra commands (like thumbnail generation) if needed.
 * 
 * @param program The parsed and analyzed Program AST
 * @param options Optional compilation flags (e.g. `start`, `end`)
 * @returns An array of ffmpeg command strings ready for execution
 */
export function generate(code: Program | ProgramV2, options: { start?: number; end?: number } = {}): string[] {
    if ('version' in code && code.version === 2) {
        return generateV2(code as ProgramV2);
    }
    const program = code as Program;
    const commands: string[] = [];

    const audioExtensions = ['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.opus', '.wma', '.aiff'];

    for (const out of program.outputs) {
        const merged = { ...program, ...out.overrides };
        let cmd = `ffmpeg`;
        const trimStart = options.start ?? (merged.trim ? parseFloat(merged.trim.start.replace(/[a-z]+$/i, '')) : undefined);
        const trimEnd = options.end ?? (merged.trim ? parseFloat(merged.trim.end.replace(/[a-z]+$/i, '')) : undefined);
        if (trimStart !== undefined) cmd += ` -ss ${trimStart}`;
        if (trimEnd !== undefined) cmd += ` -to ${trimEnd}`;
        cmd += ` -i ${program.input.value}`;

        const vfFilters: string[] = [];

        const inputExtension = program.input.value.includes('.') 
            ? program.input.value.slice(program.input.value.lastIndexOf('.')).toLowerCase() 
            : '';
        const isAudioOnly = audioExtensions.includes(inputExtension);

        if (!isAudioOnly && merged.crop) {
            if (merged.crop.x !== undefined && merged.crop.y !== undefined) {
                vfFilters.push(`crop=${merged.crop.width}:${merged.crop.height}:${merged.crop.x}:${merged.crop.y}`);
            } else {
                vfFilters.push(`crop=${merged.crop.width}:${merged.crop.height}`);
            }
        }

        if (!isAudioOnly && merged.resize) {
            vfFilters.push(`scale=${merged.resize.width}:${merged.resize.height}`);
        }

        if (!isAudioOnly && merged.fps) {
            vfFilters.push(`fps=${merged.fps.value}`);
        }

        if (!isAudioOnly && merged.rotate) {
            const rotMap: Record<number, string> = {
                90: 'transpose=1',
                180: 'transpose=1,transpose=1',
                270: 'transpose=2',
            };
            vfFilters.push(rotMap[merged.rotate.degrees]!);
        }

        if (!isAudioOnly && merged.flip) {
            vfFilters.push(merged.flip.direction === 'horizontal' ? 'hflip' : 'vflip');
        }

        if (!isAudioOnly && merged.speed && merged.speed.value !== 1) {
            const factor = Number((1 / merged.speed.value).toFixed(6));
            vfFilters.push(`setpts=${factor}*PTS`);
        }

        let outOptions = "";

        if (vfFilters.length > 0) {
            outOptions += ` -vf "${vfFilters.join(',')}"`;
        }

        if (merged.encode) {
            const vCodec = videoCodecMap[merged.encode.videoCodec] || merged.encode.videoCodec;
            outOptions += ` -c:v ${vCodec}`;
            if (!merged.mute) {
                outOptions += ` -c:a ${merged.encode.audioCodec}`;
            }
        }

        if (merged.preset) {
            outOptions += ` -preset ${merged.preset.value}`;
        }

        if (merged.crf) {
            outOptions += ` -crf ${merged.crf.value}`;
        } else if (merged.bitrate) {
            outOptions += ` -b:v ${merged.bitrate.value}`;
        }

        if (merged.mute) {
            outOptions += ' -an';
        }

        if (merged.audio && !merged.mute) {
            const audio = merged.audio;
            const afFilters: string[] = [];

            // External audio file: mix it in as a secondary input
            if (audio.value) {
                cmd += ` -i ${audio.value}`;
                afFilters.push(`amix=inputs=2:duration=first`);
            }

            // Audio codec
            if (audio.codec) {
                outOptions += ` -c:a ${audio.codec}`;
            }

            // Audio bitrate
            if (audio.bitrate) {
                outOptions += ` -b:a ${audio.bitrate}`;
            }

            // Sample rate
            if (audio.samplerate) {
                outOptions += ` -ar ${audio.samplerate}`;
            }

            // Channel layout
            if (audio.channels) {
                outOptions += ` -ac ${audio.channels === 'stereo' ? 2 : 1}`;
            }

            // Normalization — uses the loudnorm filter
            if (audio.normalize) {
                const unit = audio.normalize.unit.toLowerCase();
                const val = audio.normalize.value;
                if (unit === 'lufs') {
                    afFilters.push(`loudnorm=I=${val}`);
                } else if (unit === 'dbtp') {
                    afFilters.push(`loudnorm=TP=${val}`);
                } else if (unit === 'dbrms') {
                    afFilters.push(`loudnorm=LRA=${val}`);
                }
            }

            // EQ — bass, mid, treble via equalizer filter
            if (audio.eq) {
                const { bass, mid, treble } = audio.eq;
                if (bass !== undefined) afFilters.push(`equalizer=f=100:width_type=o:width=2:g=${bass}`);
                if (mid !== undefined)  afFilters.push(`equalizer=f=1000:width_type=o:width=2:g=${mid}`);
                if (treble !== undefined) afFilters.push(`equalizer=f=10000:width_type=o:width=2:g=${treble}`);
            }

            // Compression — uses acompressor filter
            if (audio.compress) {
                const { threshold, ratio, attack, release } = audio.compress;
                const parts: string[] = [];
                if (threshold !== undefined) parts.push(`threshold=${threshold}dB`);
                if (ratio !== undefined)     parts.push(`ratio=${ratio}`);
                if (attack !== undefined)    parts.push(`attack=${attack}`);
                if (release !== undefined)   parts.push(`release=${release}`);
                if (parts.length > 0) afFilters.push(`acompressor=${parts.join(':')}`);
            }

            // Reverb — uses aecho filter as a simple reverb approximation
            if (audio.reverb) {
                const reverbMap: Record<string, string> = {
                    subtle: 'aecho=0.8:0.8:20:0.1',
                    medium: 'aecho=0.8:0.8:60:0.3',
                    large:  'aecho=0.8:0.8:120:0.5'
                };
                const reverbFilter = reverbMap[audio.reverb];
                if (reverbFilter) afFilters.push(reverbFilter);
            }

            // Fade in / Fade out — using afade filter
            if (audio.fadein) {
                const duration = parseFloat(audio.fadein.replace(/[a-z]+$/i, ''));
                afFilters.push(`afade=t=in:st=0:d=${duration}`);
            }
            if (audio.fadeout) {
                const duration = parseFloat(audio.fadeout.replace(/[a-z]+$/i, ''));
                // st (start time) for fadeout requires knowing total duration — use a large value
                // so we use the `eval=frame` trick by letting ffmpeg calculate it at encode time
                afFilters.push(`afade=t=out:st=99999:d=${duration}`);
            }

            if (merged.speed && merged.speed.value !== 1) {
                let remaining = merged.speed.value;
                while (remaining > 2.0) {
                    afFilters.push('atempo=2.0');
                    remaining /= 2.0;
                }
                while (remaining < 0.5) {
                    afFilters.push('atempo=0.5');
                    remaining /= 0.5;
                }
                afFilters.push(`atempo=${Number(remaining.toFixed(4))}`);
            }

            if (afFilters.length > 0) {
                outOptions += ` -af "${afFilters.join(',')}"`;
            }
        } else if (!merged.mute && merged.speed && merged.speed.value !== 1) {
            let remaining = merged.speed.value;
            const afFilters: string[] = [];
            while (remaining > 2.0) {
                afFilters.push('atempo=2.0');
                remaining /= 2.0;
            }
            while (remaining < 0.5) {
                afFilters.push('atempo=0.5');
                remaining /= 0.5;
            }
            afFilters.push(`atempo=${Number(remaining.toFixed(4))}`);
            outOptions += ` -af "${afFilters.join(',')}"`;
        }

        if (merged.watermark) {
            const position = positionMap[merged.watermark.position] || '10:10';
            // The watermark file is a secondary input and MUST go before output options
            cmd += ` -i ${merged.watermark.file}`;
            outOptions += ` -filter_complex "overlay=${position}"`;
        }

        cmd += `${outOptions} ${out.file}`;
        commands.push(cmd);
    }

    if (program.thumbnail && options.start === undefined && options.end === undefined) {
        const ts = program.thumbnail.value.replace('s', '');
        commands.push(`ffmpeg -i ${program.input.value} -ss ${ts} -frames:v 1 thumb.jpg`);
    }

    return commands;
}