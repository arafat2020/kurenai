import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveTarget } from "../src/runtime/target-resolver.js";
import { detectEnvironment } from "../src/runtime/environment.js";

describe("Target Resolver & Environment Detection", () => {
    describe("detectEnvironment()", () => {
        const originalWindow = globalThis.window;

        afterEach(() => {
            if (originalWindow === undefined) {
                delete (globalThis as any).window;
            } else {
                globalThis.window = originalWindow;
            }
        });

        it("should return 'node' when window is undefined", () => {
            delete (globalThis as any).window;
            expect(detectEnvironment()).toBe("node");
        });

        it("should return 'browser' when window and window.document are defined", () => {
            (globalThis as any).window = { document: {} };
            expect(detectEnvironment()).toBe("browser");
        });
    });

    describe("resolveTarget()", () => {
        const originalWindow = globalThis.window;

        afterEach(() => {
            if (originalWindow === undefined) {
                delete (globalThis as any).window;
            } else {
                globalThis.window = originalWindow;
            }
        });

        it("should resolve to 'ffmpeg' explicitly regardless of environment", () => {
            (globalThis as any).window = { document: {} };
            expect(resolveTarget({ target: "ffmpeg" })).toBe("ffmpeg");

            delete (globalThis as any).window;
            expect(resolveTarget({ target: "ffmpeg" })).toBe("ffmpeg");
        });

        it("should resolve to 'webcodecs' explicitly regardless of environment", () => {
            delete (globalThis as any).window;
            expect(resolveTarget({ target: "webcodecs" })).toBe("webcodecs");

            (globalThis as any).window = { document: {} };
            expect(resolveTarget({ target: "webcodecs" })).toBe("webcodecs");
        });

        it("should auto-detect 'node' → 'ffmpeg' when window is undefined", () => {
            delete (globalThis as any).window;
            expect(resolveTarget({})).toBe("ffmpeg");
            expect(resolveTarget({ target: "auto" })).toBe("ffmpeg");
        });

        it("should auto-detect 'browser' → 'webcodecs' when window.document is present", () => {
            (globalThis as any).window = { document: {} };
            expect(resolveTarget({})).toBe("webcodecs");
            expect(resolveTarget({ target: "auto" })).toBe("webcodecs");
        });
    });
});
