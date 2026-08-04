import { detectEnvironment } from "./environment.js";

/**
 * The two concrete compilation targets Kurenai supports.
 *
 * - `"ffmpeg"` — Generates an FFmpeg CLI command string. Works in any
 *   environment (Node, browser, Bun, Deno). Requires FFmpeg to be installed
 *   for actual execution.
 * - `"webcodecs"` — Generates a {@link WebCodecsPipelinePlan} consumable by
 *   the mediabunny executor. Requires a browser (or Node with `@mediabunny/server`)
 *   for actual execution.
 */
export type CompileTarget = "ffmpeg" | "webcodecs";

/**
 * Options for controlling which target `compileTarget()` resolves to.
 */
export interface TargetResolutionOptions {
    /**
     * The desired compilation target.
     *
     * - `"ffmpeg"` — Always compile to FFmpeg (Node or browser).
     * - `"webcodecs"` — Always compile to WebCodecs/mediabunny.
     * - `"auto"` (default) — Detects the runtime: `"webcodecs"` in a browser,
     *   `"ffmpeg"` in Node/Bun/Deno.
     *
     * @default "auto"
     */
    target?: CompileTarget | "auto";
}

/**
 * Resolves the concrete compilation target to use.
 *
 * Priority order (first match wins):
 * 1. **Explicit caller override** — `options.target === "ffmpeg" | "webcodecs"`
 * 2. **Environment detection** — browser → `"webcodecs"`, Node → `"ffmpeg"`
 * 3. **Default** — `"ffmpeg"` (used when no option is provided at all)
 *
 * This ordering ensures the CLI (which always passes `{ target: "ffmpeg" }`)
 * can never accidentally produce a WebCodecs plan, while the library's
 * auto-detection path works for UI frameworks that don't pin a target.
 *
 * @param options Optional resolution config.
 * @returns A concrete `"ffmpeg"` or `"webcodecs"` target.
 *
 * @example
 * ```ts
 * // Auto-detect (recommended for library consumers):
 * const target = resolveTarget();             // "webcodecs" in browser, "ffmpeg" in Node
 *
 * // Explicit override (recommended for server workers and the CLI):
 * const target = resolveTarget({ target: "ffmpeg" });   // always ffmpeg
 *
 * // Force WebCodecs even from Node (for testing):
 * const target = resolveTarget({ target: "webcodecs" }); // always webcodecs
 * ```
 */
export function resolveTarget(options: TargetResolutionOptions = {}): CompileTarget {
    const { target = "auto" } = options;

    // Explicit caller override always wins
    if (target === "ffmpeg" || target === "webcodecs") {
        return target;
    }

    // "auto" — environment decides
    return detectEnvironment() === "browser" ? "webcodecs" : "ffmpeg";
}
