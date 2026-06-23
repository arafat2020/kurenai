import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
    lex,
    parse,
    analyzeAst,
    generateCommands,
    compile,
    Kurenai,
    CompilerError,
} from "../src/index";

describe("Public API", () => {
    const validSource = `
        input "video.mp4"
        resize 1280x720
        fps 30
        encode h264 aac
        output "output.mp4"
    `;

    describe("Functional API", () => {
        it("lex() should return tokens", () => {
            const tokens = lex(validSource);

            expect(tokens).toBeDefined();
            expect(Array.isArray(tokens)).toBe(true);
            expect(tokens.length).toBeGreaterThan(0);
        });

        it("parse() should return an AST", () => {
            const ast = parse(lex(validSource));

            expect(ast).toBeDefined();
        });

        it("analyzeAst() should not throw for valid input", () => {
            const ast = parse(lex(validSource));

            expect(() => analyzeAst(ast)).not.toThrow();
        });

        it("generateCommands() should return ffmpeg commands", () => {
            const ast = parse(lex(validSource));

            analyzeAst(ast);

            const commands = generateCommands(ast);

            expect(Array.isArray(commands)).toBe(true);
            expect(commands.length).toBeGreaterThan(0);
            expect(commands[0]).toContain("ffmpeg");
        });

        it("compile() should execute the full pipeline", () => {
            const result = compile(validSource);

            expect(result.ast).toBeDefined();
            expect(result.commands.length).toBeGreaterThan(0);
        });

        it("compile() should return commands array", () => {
            const result = compile(validSource);

            expect(Array.isArray(result.commands)).toBe(true);
        });

        it("compile() should throw CompilerError for invalid DSL", () => {
            expect(() =>
                compile(`
                    input "video.mp4"
                    encode potato aac
                    output "out.mp4"
                `)
            ).toThrow(CompilerError);
        });
    });

    describe("Verbose Mode", () => {
        let spy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            spy = vi.spyOn(console, "log").mockImplementation(() => {});
        });

        afterEach(() => {
            spy.mockRestore();
        });

        it("should support verbose compilation", () => {
            compile(validSource, { verbose: true });

            expect(spy).toHaveBeenCalled();
        });
    });

    describe("Kurenai Class API", () => {
        const kurenai = new Kurenai();

        it("lex() should work", () => {
            const tokens = kurenai.lex(validSource);

            expect(tokens.length).toBeGreaterThan(0);
        });

        it("parse() should work", () => {
            const ast = kurenai.parse(
                kurenai.lex(validSource)
            );

            expect(ast).toBeDefined();
        });

        it("analyze() should work", () => {
            const ast = kurenai.parse(
                kurenai.lex(validSource)
            );

            expect(() => kurenai.analyze(ast))
                .not.toThrow();
        });

        it("generate() should work", () => {
            const ast = kurenai.parse(
                kurenai.lex(validSource)
            );

            kurenai.analyze(ast);

            const commands = kurenai.generate(ast);

            expect(commands.length).toBeGreaterThan(0);
        });

        it("compile() should run the full pipeline", () => {
            const result = kurenai.compile(validSource);

            expect(result.ast).toBeDefined();
            expect(result.commands.length).toBeGreaterThan(0);
        });

        it("validate() should succeed for valid DSL", () => {
            expect(() =>
                kurenai.validate(validSource)
            ).not.toThrow();
        });

        it("validate() should throw for invalid DSL", () => {
            expect(() =>
                kurenai.validate(`
                    input "video.mp4"
                    encode invalidCodec aac
                    output "out.mp4"
                `)
            ).toThrow();
        });

        it("explain() should not throw", () => {
            const spy = vi
                .spyOn(console, "log")
                .mockImplementation(() => {});

            expect(() =>
                kurenai.explain(validSource)
            ).not.toThrow();

            spy.mockRestore();
        });
    });

    describe("API Consistency", () => {
        it("functional compile() and class compile() should produce the same output", () => {
            const functional = compile(validSource);

            const kurenai = new Kurenai();
            const classBased = kurenai.compile(validSource);

            expect(classBased.commands)
                .toEqual(functional.commands);
        });

        it("functional pipeline and class pipeline should match", () => {
            const ast1 = parse(lex(validSource));
            analyzeAst(ast1);
            const commands1 = generateCommands(ast1);

            const k = new Kurenai();

            const ast2 = k.parse(k.lex(validSource));
            k.analyze(ast2);
            const commands2 = k.generate(ast2);

            expect(commands2).toEqual(commands1);
        });
    });
});