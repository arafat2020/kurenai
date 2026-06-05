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

export function generate(program:Program):string{
    let ffmpegCommand = `ffmpeg -i ${program.input.value}`;

    const vfFilters: string[] = [];

    if (program.resize) {
        vfFilters.push(`scale=${program.resize.width}:${program.resize.height}`);
    }

    if (program.fps) {
        vfFilters.push(`fps=${program.fps.value}`);
    }

    if (vfFilters.length > 0) {
        ffmpegCommand += ` -vf "${vfFilters.join(',')}"`;
    }

    if (program.encode) {
        const vCodec = videoCodecMap[program.encode.videoCodec] || program.encode.videoCodec;
        ffmpegCommand += ` -c:v ${vCodec} -c:a ${program.encode.audioCodec}`;
    }

    if (program.bitrate) {
        ffmpegCommand += ` -b:v ${program.bitrate.value}`;
    }

    if (program.audio) {
        ffmpegCommand += ` -c:a ${program.audio.value}`;
    }

    if (program.watermark) {
        const position = positionMap[program.watermark.position] || '10:10';
        ffmpegCommand += ` -i ${program.watermark.file} -filter_complex "overlay=${position}"`;
    }

    if (program.thumbnail) {
        ffmpegCommand += ` -ss ${program.thumbnail.value.replace('s', '')} -frames:v 1 thumb.jpg`;
    }

    ffmpegCommand += ` ${program.output.value}`;

    return ffmpegCommand;
}