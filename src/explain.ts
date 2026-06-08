import { Program } from "./parser";
import { videoCodecMap } from "./codegen";

function sectionHeader(title: string): string {
    return `\n${title}:`;
}

function checkLine(label: string): string {
    return `  ✓ ${label}`;
}

export function explain(program: Program, commands: string[]): void {
    // ── Input / Output ──
    console.log(`Input:    ${program.input.value}`);
    console.log(`Output:   ${program.output.value}`);

    // ── Filters ──
    const hasFilters = program.resize || program.fps;
    if (hasFilters) {
        console.log(sectionHeader('Filters'));

        if (program.resize) {
            console.log(checkLine(`scale ${program.resize.width}x${program.resize.height}`));
        }
        if (program.fps) {
            console.log(checkLine(`fps ${program.fps.value}`));
        }
    }

    // ── Encoding ──
    const hasEncoding = program.encode || program.bitrate || program.audio;
    if (hasEncoding) {
        console.log(sectionHeader('Encoding'));

        if (program.encode) {
            const ffmpegCodec = videoCodecMap[program.encode.videoCodec] || program.encode.videoCodec;
            console.log(checkLine(`video codec: ${program.encode.videoCodec} → ${ffmpegCodec}`));
            console.log(checkLine(`audio codec: ${program.encode.audioCodec}`));
        }
        if (program.bitrate) {
            console.log(checkLine(`bitrate: ${program.bitrate.value}`));
        }
        if (program.audio) {
            console.log(checkLine(`audio: ${program.audio.value}`));
        }
    }

    // ── Extras ──
    const hasExtras = program.watermark || program.thumbnail;
    if (hasExtras) {
        console.log(sectionHeader('Extras'));

        if (program.watermark) {
            console.log(checkLine(`watermark: ${program.watermark.file} at ${program.watermark.position}`));
        }
        if (program.thumbnail) {
            console.log(checkLine(`thumbnail at ${program.thumbnail.value}`));
        }
    }

    // ── FFmpeg command(s) ──
    console.log(sectionHeader('FFmpeg command'));
    for (const cmd of commands) {
        console.log(`  ${cmd}`);
    }
}