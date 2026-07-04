import { type ProgramV2 } from "./interfaces/v2.js";
import { CompilerError } from "./errors.js";
import {
    analyzeFps,
    analyzeResize,
    analyzeEncode,
    analyzeWatermark,
    analyzeOutput,
} from "./analyzer.js";

/**
 * Validates a ProgramV2 AST for semantic correctness and reports CompilerErrors.
 */
export function analyzeV2(program: ProgramV2): void {
    // 1. At least one source
    if (!program.sources || Object.keys(program.sources).length === 0) {
        throw new CompilerError("At least one source is required.", program.line, program.column, program.length);
    }

    // 2. Output required
    if (!program.outputs || program.outputs.length === 0) {
        throw new CompilerError("Output file is missing.", program.line, program.column, program.length);
    }

    // 3. Timeline required if clips are defined
    const hasClips = program.clips && Object.keys(program.clips).length > 0;
    if (hasClips && !program.timeline) {
        throw new CompilerError("Timeline is required when clips are defined.", program.line, program.column, program.length);
    }

    // 4. Validate sources formats (supported video/audio files)
    const supportedVideoFormats = [".mp4", ".avi", ".mkv", ".mov", ".flv", ".wmv", ".webm", ".mpeg", ".mpg", ".m4v"];
    const supportedAudioFormats = [".mp3", ".wav", ".aac", ".flac", ".ogg", ".m4a", ".opus", ".wma", ".aiff"];
    const supportedFormats = [...supportedVideoFormats, ...supportedAudioFormats];

    for (const [name, source] of Object.entries(program.sources)) {
        const ext = source.file.includes('.') 
            ? source.file.slice(source.file.lastIndexOf('.')).toLowerCase() 
            : '';
        if (!supportedFormats.includes(ext)) {
            throw new CompilerError(`Unsupported source format: ${ext || 'No extension provided'}`, source.line, source.column, source.length);
        }
    }

    // 5. Validate clips
    if (program.clips) {
        for (const [name, clip] of Object.entries(program.clips)) {
            // Source exists
            if (!(clip.sourceName in program.sources)) {
                throw new CompilerError(`Clip "${name}" references unknown source "${clip.sourceName}"`, clip.line, clip.column, clip.length);
            }

            // No circular references
            if (clip.sourceName === name) {
                throw new CompilerError(`Clip "${name}" cannot reference itself as a source`, clip.line, clip.column, clip.length);
            }

            // Clip time range valid
            const start = parseInt(clip.start.replace("s", ""), 10);
            const end = parseInt(clip.end.replace("s", ""), 10);
            if (start >= end) {
                throw new CompilerError(`Clip "${name}" start must be less than end`, clip.line, clip.column, clip.length);
            }
        }
    }

    // 6. Validate mixes
    if (program.mixes) {
        for (const [mixName, mix] of Object.entries(program.mixes)) {
            for (const track of mix.tracks) {
                // Mix source exists
                if (!(track.sourceName in program.sources)) {
                    throw new CompilerError(`Track in mix "${mixName}" references unknown source "${track.sourceName}"`, track.line, track.column, track.length);
                }
            }
        }
    }

    // 7. Validate timeline clips
    if (program.timeline) {
        for (const clipName of program.timeline.clips) {
            // Clip exists in timeline
            if (!(clipName in program.clips)) {
                throw new CompilerError(`Timeline references unknown clip "${clipName}"`, program.timeline.line, program.timeline.column, program.timeline.length);
            }
        }
    }

    // 8. Validate audio mix reference
    if (program.audio && program.audio.value) {
        const audioName = program.audio.value;
        const hasAudioExtension = supportedAudioFormats.some(ext => audioName.toLowerCase().endsWith(ext));
        if (!hasAudioExtension) {
            if (!program.mixes || !(audioName in program.mixes)) {
                throw new CompilerError(`Audio mix "${audioName}" not found`, program.audio.line, program.audio.column, program.audio.length);
            }
        }
    }

    // 9. Run V1-based validations on carried-over fields
    analyzeFps(program.fps);
    analyzeResize(program.resize);
    analyzeEncode(program.encode);
    analyzeWatermark(program.watermark);

    if (program.outputs) {
        for (const output of program.outputs) {
            analyzeOutput(output as any, program as any);
            // Also validate overrides in outputs
            if (output.overrides) {
                analyzeFps(output.overrides.fps);
                analyzeResize(output.overrides.resize);
                analyzeEncode(output.overrides.encode);
                analyzeWatermark(output.overrides.watermark);
            }
        }
    }
}
