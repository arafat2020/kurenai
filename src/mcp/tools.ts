import { readFileSync, existsSync } from "node:fs";
import { resolve, isAbsolute, relative, sep } from "node:path";
import { execFileSync } from "node:child_process";
import { compile, compileTarget, CompilerError } from "../index.js";
import { lexer } from "../lexer.js";
import { parseTokens, type Program } from "../parser.js";
import { analyze } from "../analyzer.js";
import { generate } from "../codegen.js";
import { explain } from "../explain.js";
import { type ProgramV2 } from "../interfaces/v2.js";

export interface McpToolResult {
    ok: boolean;
    content: string;
    isError?: boolean;
}

function formatCompilerError(err: CompilerError, source: string): string {
    const lines = source.split("\n");
    const lineText = lines[err.line - 1] ?? "";
    const padding = " ".repeat(Math.max(0, err.column - 1));
    const underlines = "^".repeat(Math.max(1, err.length));
    return [
        `Error on line ${err.line}:`,
        `  ${lineText}`,
        `  ${padding}${underlines}`,
        `  ${err.message}`,
    ].join("\n");
}

function resolveSource(input: { source?: string | undefined; file?: string | undefined }): string {
    if (input.source && input.source.trim().length > 0) {
        return input.source;
    }
    if (input.file) {
        const path = isAbsolute(input.file) ? input.file : resolve(process.cwd(), input.file);
        if (!path.endsWith(".crn")) {
            throw new Error("File must have a .crn extension");
        }
        if (!existsSync(path)) {
            throw new Error(`File not found: ${path}`);
        }
        return readFileSync(path, "utf-8");
    }
    throw new Error("Provide either `source` (DSL string) or `file` (path to a .crn script)");
}

function wrapOk(payload: unknown): McpToolResult {
    return {
        ok: true,
        content: typeof payload === "string" ? payload : JSON.stringify(payload, null, 2),
    };
}

function isInsideCwd(filePath: string, cwd: string): boolean {
    const abs = isAbsolute(filePath) ? resolve(filePath) : resolve(cwd, filePath);
    const rel = relative(cwd, abs);
    if (rel === "") return true;
    if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) return false;
    return true;
}

function collectMediaPaths(ast: Program | ProgramV2): string[] {
    const paths: string[] = [];
    const push = (value: string | undefined) => {
        if (value && value.trim().length > 0) paths.push(value);
    };

    if (ast.version === 2) {
        const program = ast as ProgramV2;
        for (const source of Object.values(program.sources)) push(source.file);
    } else {
        const program = ast as Program;
        push(program.input.value);
        push(program.audio?.value);
    }

    push(ast.watermark?.file);
    for (const out of ast.outputs) push(out.file);
    return paths;
}

function wrapErr(err: unknown, source?: string): McpToolResult {
    if (err instanceof CompilerError && source !== undefined) {
        return { ok: false, isError: true, content: formatCompilerError(err, source) };
    }
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, isError: true, content: message };
}

/**
 * FFmpeg commands from the same generator `kurenai_run` executes.
 * WebCodecs stays on the target-dispatch pipeline.
 */
function compileForTool(args: {
    source: string;
    target?: "ffmpeg" | "webcodecs" | undefined;
    start?: number | undefined;
    end?: number | undefined;
}): { target: "ffmpeg"; commands: string[]; ast: Program | ProgramV2 } | { target: "webcodecs"; plan: unknown } {
    if ((args.target ?? "ffmpeg") === "webcodecs") {
        const options: Parameters<typeof compileTarget>[1] = { target: "webcodecs" };
        if (args.start !== undefined) options.start = args.start;
        if (args.end !== undefined) options.end = args.end;
        const result = compileTarget(args.source, options);
        if (result.target !== "webcodecs") {
            throw new Error("Expected a WebCodecs plan");
        }
        return { target: "webcodecs", plan: result.plan };
    }

    const options: Parameters<typeof compile>[1] = {};
    if (args.start !== undefined) options.start = args.start;
    if (args.end !== undefined) options.end = args.end;
    const { ast, commands } = compile(args.source, options);
    return { target: "ffmpeg", commands, ast };
}

/** Compile a Kurenai DSL script to FFmpeg commands or a WebCodecs plan. */
export function toolCompile(args: {
    source?: string | undefined;
    file?: string | undefined;
    target?: "ffmpeg" | "webcodecs" | undefined;
    start?: number | undefined;
    end?: number | undefined;
}): McpToolResult {
    let source = "";
    try {
        source = resolveSource(args);
        const request: Parameters<typeof compileForTool>[0] = { source };
        if (args.target !== undefined) request.target = args.target;
        if (args.start !== undefined) request.start = args.start;
        if (args.end !== undefined) request.end = args.end;
        const result = compileForTool(request);
        if (result.target === "ffmpeg") {
            return wrapOk({ target: "ffmpeg", commands: result.commands });
        }
        return wrapOk({ target: "webcodecs", plan: result.plan });
    } catch (err) {
        return wrapErr(err, source);
    }
}

/** Validate syntax + semantics without generating commands. */
export function toolValidate(args: { source?: string | undefined; file?: string | undefined }): McpToolResult {
    let source = "";
    try {
        source = resolveSource(args);
        const tokens = lexer(source);
        const ast = parseTokens(tokens);
        analyze(ast);
        return wrapOk({ valid: true, message: "Script is valid." });
    } catch (err) {
        return wrapErr(err, source);
    }
}

/**
 * Human-readable explanation of what the script does.
 * Captures explain()'s console output.
 */
export function toolExplain(args: { source?: string | undefined; file?: string | undefined }): McpToolResult {
    let source = "";
    const logs: string[] = [];
    const originalLog = console.log;
    try {
        source = resolveSource(args);
        const tokens = lexer(source);
        const ast = parseTokens(tokens);
        analyze(ast);
        const commands = generate(ast);
        console.log = (...parts: unknown[]) => {
            logs.push(parts.map(String).join(" "));
        };
        explain(ast, commands);
        console.log = originalLog;
        return wrapOk({ explanation: logs.join("\n"), commands });
    } catch (err) {
        console.log = originalLog;
        return wrapErr(err, source);
    }
}

/**
 * Scaffold a starter .crn script from a named intent.
 * Keeps agents from inventing invalid DSL.
 */
export function toolScaffold(args: {
    intent:
        | "resize"
        | "podcast"
        | "watermark"
        | "trim"
        | "mute"
        | "rotate"
        | "gif_ready"
        | "quality";
    input?: string | undefined;
    output?: string | undefined;
}): McpToolResult {
    const input = args.input ?? "input.mp4";
    const output = args.output ?? "output.mp4";

    const templates: Record<typeof args.intent, string> = {
        resize: [
            `input "${input}"`,
            `resize 1280x720`,
            `fps 30`,
            `encode h264 aac`,
            `crf 23`,
            `preset medium`,
            `output "${output}"`,
        ].join("\n"),
        podcast: [
            `input "${args.input ?? "podcast.mp3"}"`,
            `audio {`,
            `  normalize -14 LUFS`,
            `  codec aac`,
            `  bitrate 192k`,
            `}`,
            `output "${args.output ?? "mastered.mp3"}"`,
        ].join("\n"),
        watermark: [
            `input "${input}"`,
            `encode h264 aac`,
            `crf 23`,
            `watermark "logo.png" bottom-right`,
            `output "${output}"`,
        ].join("\n"),
        trim: [
            `input "${input}"`,
            `trim 10s 60s`,
            `encode h264 aac`,
            `crf 23`,
            `output "${output}"`,
        ].join("\n"),
        mute: [
            `input "${input}"`,
            `mute`,
            `encode h264 aac`,
            `crf 23`,
            `output "${output}"`,
        ].join("\n"),
        rotate: [
            `input "${input}"`,
            `rotate 90`,
            `encode h264 aac`,
            `crf 23`,
            `output "${output}"`,
        ].join("\n"),
        gif_ready: [
            `input "${input}"`,
            `trim 0s 5s`,
            `resize 480x270`,
            `fps 12`,
            `mute`,
            `output "${args.output ?? "clip.mp4"}"`,
        ].join("\n"),
        quality: [
            `input "${input}"`,
            `encode h264 aac`,
            `crf 18`,
            `preset slow`,
            `output "${output}"`,
        ].join("\n"),
    };

    const source = templates[args.intent];
    try {
        // Ensure scaffold is always valid
        compile(source);
        return wrapOk({ intent: args.intent, source });
    } catch (err) {
        return wrapErr(err, source);
    }
}

/**
 * Execute compiled FFmpeg commands.
 * Defaults to dry-run. Only runs when execute=true.
 * Rejects path escape outside cwd unless allowOutsideCwd is set.
 */
export function toolRun(args: {
    source?: string | undefined;
    file?: string | undefined;
    execute?: boolean | undefined;
    allowOutsideCwd?: boolean | undefined;
}): McpToolResult {
    let source = "";
    try {
        source = resolveSource(args);
        const { ast, commands } = compile(source);
        const cwd = process.cwd();

        if (!args.allowOutsideCwd) {
            for (const filePath of collectMediaPaths(ast)) {
                if (!isInsideCwd(filePath, cwd)) {
                    throw new Error(
                        `Refusing path outside cwd: ${filePath}. Pass allowOutsideCwd=true to override.`,
                    );
                }
            }
        }

        if (!args.execute) {
            return wrapOk({
                dryRun: true,
                message: "Dry-run only. Re-call with execute=true to run FFmpeg.",
                commands,
            });
        }

        const results: string[] = [];
        for (const cmd of commands) {
            if (!cmd.trimStart().startsWith("ffmpeg ")) {
                results.push(`SKIP: ${cmd.split("\n")[0]}`);
                continue;
            }
            // Split carefully: first token is ffmpeg, rest are args.
            const parts = cmd.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [cmd];
            const bin = parts[0]!;
            const argv = parts.slice(1).map((p) => p.replace(/^"(.*)"$/, "$1"));
            execFileSync(bin, argv, { stdio: "pipe", encoding: "utf-8" });
            results.push(`OK: ${cmd}`);
        }
        return wrapOk({ dryRun: false, executed: results });
    } catch (err) {
        return wrapErr(err, source);
    }
}

/** Short DSL reference for agents. */
export const DSL_REFERENCE = `# Kurenai DSL quick reference

## Core
input "file.mp4"
output "out.mp4"
resize 1280x720
fps 30
encode h264 aac
bitrate 3000k
crf 23
preset medium
trim 10s 60s
mute
rotate 90
flip horizontal
crop 1280x720
crop 1280x720 100 50
speed 1.5
watermark "logo.png" bottom-right
thumbnail 5s

## Audio block
audio {
  normalize -14 LUFS
  codec aac
  bitrate 192k
  samplerate 48000
  channels stereo
  eq { bass +3db mid -1db treble +2db }
  compress { threshold -18db ratio 4:1 attack 5ms release 100ms }
  reverb subtle
  fadein 2s
  fadeout 3s
}

## Tips for agents
1. Prefer \`crf\` + \`preset\` over guessing bitrates.
2. Always \`validate\` before \`run\`.
3. Use \`scaffold\` for a known-good starter script.
4. \`run\` defaults to dry-run; set execute=true only after user consent.
`;
