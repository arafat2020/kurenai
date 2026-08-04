/**
 * Represents the runtime environment Kurenai is executing in.
 *
 * - `"browser"` — A browser context with `window` and `document` present
 *   (including browser-based runtimes like Electron's renderer process).
 * - `"node"` — Any non-browser environment (Node.js, Bun, Deno, Electron's
 *   main process, Jest/Vitest with jsdom but without a real `window.document`).
 */
export type RuntimeEnvironment = "node" | "browser";

/**
 * Detects the current runtime environment by probing `window` and `document`.
 *
 * This is the **only** place in Kurenai that touches `typeof window`.
 * Every other module imports `detectEnvironment()` rather than re-checking
 * globals, so if detection logic ever needs to get smarter (Web Workers,
 * Bun, Deno, jsdom mocks), it changes in exactly one place.
 *
 * @returns `"browser"` when `window` and `window.document` exist;
 *          `"node"` otherwise.
 *
 * @example
 * ```ts
 * import { detectEnvironment } from "@arafat2020/kurenai";
 *
 * if (detectEnvironment() === "browser") {
 *   // Use browser-native APIs
 * }
 * ```
 */
export function detectEnvironment(): RuntimeEnvironment {
    const isBrowser =
        typeof window !== "undefined" &&
        typeof window.document !== "undefined";

    return isBrowser ? "browser" : "node";
}
