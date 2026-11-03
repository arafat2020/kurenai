import { describe, it, expect } from "vitest";
import { compile, compileTarget } from "../src/index.js";
import { CompilerError } from "../src/errors.js";

describe("FFmpeg power keywords", () => {
    it("compiles trim, crf, preset", () => {
        const source = `
input "video.mp4"
trim 10s 60s
encode h264 aac
crf 23
preset medium
output "out.mp4"
`;
        const { commands } = compile(source);
        expect(commands[0]).toContain("-ss 10");
        expect(commands[0]).toContain("-to 60");
        expect(commands[0]).toContain("-crf 23");
        expect(commands[0]).toContain("-preset medium");
        expect(commands[0]).not.toContain("-b:v");
    });

    it("compiles mute, rotate, flip, crop via compileTarget IR path", () => {
        const source = `
input "video.mp4"
mute
rotate 90
flip horizontal
crop 1280x720 10 20
encode h264 aac
crf 28
output "out.mp4"
`;
        const result = compileTarget(source, { target: "ffmpeg" });
        expect(result.target).toBe("ffmpeg");
        if (result.target !== "ffmpeg") return;
        const cmd = result.commands[0]!;
        expect(cmd).toContain("-an");
        expect(cmd).toContain("transpose=1");
        expect(cmd).toContain("hflip");
        expect(cmd).toContain("crop=1280:720:10:20");
        expect(cmd).toContain("-crf 28");
        expect(cmd).not.toContain("-af");
    });

    it("compiles speed with setpts + atempo when audio is kept", () => {
        const result = compileTarget(`
input "video.mp4"
speed 2
encode h264 aac
output "out.mp4"
`, { target: "ffmpeg" });
        expect(result.target).toBe("ffmpeg");
        if (result.target !== "ffmpeg") return;
        const cmd = result.commands[0]!;
        expect(cmd).toContain("setpts=0.5*PTS");
        expect(cmd).toContain("atempo=2");
    });

    it("centers crop when offsets omitted", () => {
        const { commands } = compile(`
input "video.mp4"
crop 640x360
output "out.mp4"
`);
        expect(commands[0]).toContain('crop=640:360');
        expect(commands[0]).not.toContain("crop=640:360:");
    });

    it("rejects invalid rotate / preset / crf", () => {
        expect(() => compile(`input "a.mp4"\nrotate 45\noutput "o.mp4"`)).toThrow(CompilerError);
        expect(() => compile(`input "a.mp4"\npreset turbo\noutput "o.mp4"`)).toThrow(CompilerError);
        expect(() => compile(`input "a.mp4"\ncrf 99\noutput "o.mp4"`)).toThrow(CompilerError);
    });
});
