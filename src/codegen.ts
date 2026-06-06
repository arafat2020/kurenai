import { Program } from "./parser";

const videoCodecMap: Record<string, string> = {
    h264: 'libx264',
    h265: 'libx265',
    vp8: 'libvpx',
    vp9: 'libvpx-vp9',
    av1: 'libaom-av1',
    mpeg2video: 'mpeg2video',
    theora: 'libtheora'
};

const positionMap: Record<string, string> = {
    'top-left': '10:10',
    'top-right': 'main_w-overlay_w-10:10',
    'bottom-left': '10:main_h-overlay_h-10',
    'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10',
    'center': '(main_w-overlay_w)/2:(main_h-overlay_h)/2'
};

export function generate(program:Program): string[] {
    let mainCommand = `ffmpeg -i ${program.input.value}`;

    const vfFilters: string[] = [];

    if (program.resize) {
        vfFilters.push(`scale=${program.resize.width}:${program.resize.height}`);
    }

    if (program.fps) {
        vfFilters.push(`fps=${program.fps.value}`);
    }

    if (vfFilters.length > 0) {
        mainCommand += ` -vf "${vfFilters.join(',')}"`;
    }

    if (program.encode) {
        const vCodec = videoCodecMap[program.encode.videoCodec] || program.encode.videoCodec;
        mainCommand += ` -c:v ${vCodec} -c:a ${program.encode.audioCodec}`;
    }

    if (program.bitrate) {
        mainCommand += ` -b:v ${program.bitrate.value}`;
    }

    if (program.audio) {
        mainCommand += ` -c:a ${program.audio.value}`;
    }

    if (program.watermark) {
        const position = positionMap[program.watermark.position] || '10:10';
        mainCommand += ` -i ${program.watermark.file} -filter_complex "overlay=${position}"`;
    }

    mainCommand += ` ${program.output.value}`;

    const commands: string[] = [mainCommand];

    if (program.thumbnail) {
        const thumbCommand = `ffmpeg -i ${program.input.value} -ss ${program.thumbnail.value.replace('s', '')} -frames:v 1 thumb.jpg`;
        commands.push(thumbCommand);
    }

    return commands;
}