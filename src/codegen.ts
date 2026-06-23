import { Program } from "./parser";

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

/**
 * Translates the validated Program AST into an array of executable FFmpeg commands.
 * It builds the main ffmpeg pipeline and adds extra commands (like thumbnail generation) if needed.
 * 
 * @param program The parsed and analyzed Program AST
 * @returns An array of ffmpeg command strings ready for execution
 */
export function generate(program:Program): string[] {
    const commands: string[] = [];

    for (const out of program.outputs) {
        let cmd = `ffmpeg -i ${program.input.value}`;
        const merged = { ...program, ...out.overrides };
        const vfFilters: string[] = [];

        if (merged.resize) {
            vfFilters.push(`scale=${merged.resize.width}:${merged.resize.height}`);
        }

        if (merged.fps) {
            vfFilters.push(`fps=${merged.fps.value}`);
        }

        let outOptions = "";

        if (vfFilters.length > 0) {
            outOptions += ` -vf "${vfFilters.join(',')}"`;
        }

        if (merged.encode) {
            const vCodec = videoCodecMap[merged.encode.videoCodec] || merged.encode.videoCodec;
            outOptions += ` -c:v ${vCodec} -c:a ${merged.encode.audioCodec}`;
        }

        if (merged.bitrate) {
            outOptions += ` -b:v ${merged.bitrate.value}`;
        }

        if (merged.audio) {
            outOptions += ` -c:a ${merged.audio.value}`;
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

    if (program.thumbnail) {
        const thumbCommand = `ffmpeg -i ${program.input.value} -ss ${program.thumbnail.value.replace('s', '')} -frames:v 1 thumb.jpg`;
        commands.push(thumbCommand);
    }

    return commands;
}