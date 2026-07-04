import { type ProgramV2 } from "./interfaces/v2.js";
import { type CompileOptions } from "./index.js";
import { videoCodecMap } from "./codegen.js";

const positionMap: Record<string, string> = {
    'top-left': '10:10',
    'top-right': 'main_w-overlay_w-10:10',
    'bottom-left': '10:main_h-overlay_h-10',
    'bottom-right': 'main_w-overlay_w-10:main_h-overlay_h-10',
    'center': '(main_w-overlay_w)/2:(main_h-overlay_h)/2'
};

/**
 * Translates the validated ProgramV2 AST into an array of executable FFmpeg commands.
 */
export function generateV2(program: ProgramV2, options: CompileOptions = {}): string[] {
    const commands: string[] = [];
    const audioExtensions = ['.mp3', '.wav', '.aac', '.flac', '.ogg', '.m4a', '.opus', '.wma', '.aiff'];

    // Pass 1 — render each clip in the timeline order
    if (program.timeline) {
        for (const clipName of program.timeline.clips) {
            const clip = program.clips[clipName]!;
            const source = program.sources[clip.sourceName]!;
            const start = clip.start.replace("s", "");
            const end = clip.end.replace("s", "");
            const sourceExt = source.file.includes('.') ? source.file.slice(source.file.lastIndexOf('.')).toLowerCase() : '';
            const isAudioOnly = audioExtensions.includes(sourceExt);

            let cmd = `ffmpeg -ss ${start} -to ${end} -i ${source.file}`;
            let outOptions = "";
            const vfFilters: string[] = [];

            if (!isAudioOnly && program.resize) {
                vfFilters.push(`scale=${program.resize.width}:${program.resize.height}`);
            }
            if (!isAudioOnly && program.fps) {
                vfFilters.push(`fps=${program.fps.value}`);
            }
            if (vfFilters.length > 0) {
                outOptions += ` -vf "${vfFilters.join(',')}"`;
            }
            if (program.encode) {
                const vCodec = videoCodecMap[program.encode.videoCodec] || program.encode.videoCodec;
                outOptions += ` -c:v ${vCodec} -c:a ${program.encode.audioCodec}`;
            }
            if (program.bitrate) {
                outOptions += ` -b:v ${program.bitrate.value}`;
            }
            if (!isAudioOnly && program.watermark) {
                const position = positionMap[program.watermark.position] || '10:10';
                cmd += ` -i ${program.watermark.file}`;
                outOptions += ` -filter_complex "overlay=${position}"`;
            }
            cmd += `${outOptions} segment_${clipName}.mp4`;
            commands.push(cmd);
        }
    }

    // Pass 2 — Concat assembly
    if (program.timeline && program.timeline.clips.length > 0) {
        const segmentList = program.timeline.clips
            .map(name => `file segment_${name}.mp4`)
            .join("\n");
        commands.push(`# Write to segments.txt:\n${segmentList}`);

        for (const out of program.outputs) {
            const outputFile = out.file;
            let concatCmd = `ffmpeg -f concat -safe 0 -i segments.txt`;
            let filterComplex = "";
            let mapArgs = "";
            let hasComplexAudio = false;

            const audioNode = out.overrides?.audio || program.audio;
            if (audioNode && audioNode.value) {
                const mixName = audioNode.value;
                const mix = program.mixes?.[mixName];
                if (mix) {
                    hasComplexAudio = true;
                    const inputs: string[] = [];
                    const filters: string[] = [];
                    const trackAliases: string[] = [];
                    let idx = 1;
                    for (const track of mix.tracks) {
                        const trackSrc = program.sources[track.sourceName]!;
                        inputs.push(`-i ${trackSrc.file}`);
                        filters.push(`[${idx}:a]volume=${track.volume}[${track.sourceName}]`);
                        trackAliases.push(`[${track.sourceName}]`);
                        idx++;
                    }
                    concatCmd += " " + inputs.join(" ");
                    // For amix with tracks and input 0 (the segments video)
                    // The amix inputs should include [0:a] (if input 0 has audio) or not?
                    // Wait, the specification says:
                    // -filter_complex "[1:a]volume=0.3[music];[2:a]volume=1.0[voice];[music][voice]amix=inputs=2:duration=longest[aout]" -map [aout]
                    // Look at this filter complex carefully!
                    // It does NOT include [0:a] in the inputs of amix!
                    // It only mixes [music] and [voice] (inputs 1 and 2), and outputs it as [aout], ignoring the segment audio!
                    // This means we only mix the named tracks specified in the mix block!
                    // Let's check page 12 OCR volume mixing again:
                    // -filter_complex "[1:a]volume=0.3[music];[2:a]volume=1.0[voice];[music][voice]amix=inputs=2:duration=longest[aout]" -map [aout]
                    // This confirms it only mixes the two music tracks, and maps it to [aout]!
                    // So we do NOT mix [0:a]. We only mix the tracks from the mix node.
                    filterComplex = filters.join(";") + ";" + trackAliases.join("") + `amix=inputs=${mix.tracks.length}:duration=longest[aout]`;
                    
                    const audioCodec = out.overrides?.encode?.audioCodec || program.encode?.audioCodec || audioNode.codec || "aac";
                    mapArgs = `-filter_complex "${filterComplex}" -map 0:v -c:v copy -map [aout] -c:a ${audioCodec}`;
                } else {
                    // Standard V1 audio file: mix it in as a secondary input
                    hasComplexAudio = true;
                    concatCmd += ` -i ${audioNode.value}`;
                    // In V1, it uses: [0:a][1:a]amix=inputs=2:duration=first[aout] (or similar)
                    // Wait, let's see how V1 does it:
                    // In codegen.ts line 79-80:
                    // cmd += ` -i ${audio.value}`;
                    // afFilters.push(`amix=inputs=2:duration=first`);
                    // And this was added to the main filter string!
                    // For concat assembly with a single audio file, we can do amix of input 0 (segment) and input 1 (audio file)
                    filterComplex = `[0:a][1:a]amix=inputs=2:duration=first[aout]`;
                    const audioCodec = out.overrides?.encode?.audioCodec || program.encode?.audioCodec || audioNode.codec || "aac";
                    mapArgs = `-filter_complex "${filterComplex}" -map 0:v -c:v copy -map [aout] -c:a ${audioCodec}`;
                }
            }

            if (hasComplexAudio) {
                concatCmd += ` ${mapArgs} ${outputFile}`;
            } else {
                concatCmd += ` -c copy ${outputFile}`;
            }
            commands.push(concatCmd);
        }
    }

    // Pass 3 — Extract thumbnail if defined
    if (program.thumbnail && program.outputs.length > 0) {
        const firstOutput = program.outputs[0]!.file;
        const thumbCommand = `ffmpeg -i ${firstOutput} -ss ${program.thumbnail.value.replace('s', '')} -frames:v 1 thumb.jpg`;
        commands.push(thumbCommand);
    }

    return commands;
}
