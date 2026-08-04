import { describe, it, expect } from "vitest";
import {
    compileTarget,
    checkWebCodecsCapability,
    executeWebCodecsPipeline,
    buildIR,
    detectEnvironment,
    resolveTarget,
} from "../src/browser.js";

describe("Browser Entry Point Exports (@arafat2020/kurenai/browser)", () => {
    it("re-exports core compiler functions from index.js", () => {
        expect(typeof compileTarget).toBe("function");
        expect(typeof buildIR).toBe("function");
        expect(typeof detectEnvironment).toBe("function");
        expect(typeof resolveTarget).toBe("function");
    });

    it("exports browser-specific execution and capability utilities", () => {
        expect(typeof checkWebCodecsCapability).toBe("function");
        expect(typeof executeWebCodecsPipeline).toBe("function");
    });

    it("can compile a target and perform capability check via browser entry imports", async () => {
        const source = `
            input "input.mp4"
            resize 1280x720
            encode h264 aac
            output "output.mp4"
        `;

        const res = compileTarget(source, { target: "webcodecs" });
        expect(res.target).toBe("webcodecs");

        // Runs without throwing (will check VideoEncoder in node environment)
        const cap = await checkWebCodecsCapability(res.plan);
        expect(cap).toBeDefined();
        expect(typeof cap.supported).toBe("boolean");
    });
});
