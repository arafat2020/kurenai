/**
 * @fileoverview Browser entry point for Kurenai (@arafat2020/kurenai/browser).
 *
 * Re-exports the main Kurenai compiler API plus browser-specific WebCodecs tools:
 * - `checkWebCodecsCapability` — Pre-flight browser encoder check
 * - `executeWebCodecsPipeline` — mediabunny-backed execution engine for WebCodecs plans
 */

export * from "./index.js";

export {
    checkWebCodecsCapability,
    type CapabilityCheckResult,
} from "./targets/webcodecs/capability-check.js";

export {
    executeWebCodecsPipeline,
    type ExecutionProgress,
    type ProgressCallback,
    type ExecutionResult,
} from "./targets/webcodecs/executor.js";
