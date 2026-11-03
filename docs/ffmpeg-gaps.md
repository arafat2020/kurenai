# FFmpeg Coverage — Gaps & MCP Priorities

Kurenai will never wrap every FFmpeg flag. The goal is a **constrained, agent-safe DSL** that covers the pipelines people (and MCP clients) actually ask for.

## Now supported (V1 DSL → FFmpeg)

| Intent | DSL | FFmpeg |
|---|---|---|
| Input / output | `input` / `output` | `-i` / outfile |
| Resize | `resize WxH` | `scale=` |
| FPS | `fps N` | `fps=` |
| Codecs | `encode h264 aac` | `-c:v` / `-c:a` |
| Bitrate | `bitrate 3000k` | `-b:v` |
| Quality | `crf 23` | `-crf` (preferred over bitrate when set) |
| Encoder speed | `preset medium` | `-preset` |
| Trim | `trim 10s 60s` | `-ss` / `-to` |
| Mute | `mute` | `-an` |
| Rotate | `rotate 90\|180\|270` | `transpose` |
| Flip | `flip horizontal\|vertical` | `hflip` / `vflip` |
| Crop | `crop WxH [x y]` | `crop=` |
| Speed | `speed 1.5` | `setpts` + `atempo` |
| Watermark | `watermark "logo.png" pos` | `overlay` |
| Thumbnail | `thumbnail 5s` | second command |
| Audio mastering | `audio { ... }` | loudnorm / EQ / compress / reverb / fade |
| Multi-output | multiple `output` blocks | one command each |
| V2 timeline | `use v2` + sources/clips/mix | concat / amix graphs |

## Intentionally deferred (still gaps)

These matter for “full FFmpeg power” but are lower priority for the first MCP cut:

| Gap | Why it waits | MCP workaround today |
|---|---|---|
| Burn-in subtitles / `drawtext` | Needs font path + escaping rules | Ask user for Ass/SRT burn via custom follow-up |
| Hardware encode (`h264_nvenc`, VideoToolbox) | Machine-specific | Use `preset`/`crf` software path |
| Stream copy (`-c copy`) | Conflicts with filters | Avoid filters, or hand-edit generated cmd |
| Complex filter graphs (PiP, side-by-side) | Explodes DSL surface | V2 timeline covers concat/mix first |
| GIF palettegen two-pass | Multi-command dance | `gif_ready` scaffold → short MP4 |
| Seek accuracy (`-ss` after `-i`) | Tradeoff vs speed | Current pre-input `-ss` is the fast path |
| Per-stream mapping (`-map`) | Advanced remux | Not in DSL yet |
| HDR / color space / pixel format | Niche | Not in DSL yet |
| Network inputs (RTMP/HLS) | Security risk for MCP `run` | Local files only |

## MCP guidance

1. Prefer **`crf` + `preset`** over inventing bitrates.
2. Use **`kurenai_scaffold`** then edit, instead of free-hand DSL.
3. Always **`kurenai_validate`** before **`kurenai_run`**.
4. Keep **`execute=false`** (dry-run) until the user confirms.
5. When a user asks for something in the deferred table, say so and offer the closest supported pipeline.

## Extending later

Add keywords the same way as `trim` / `crf` / …:

1. Lexer keyword  
2. `src/core/*Parser.ts`  
3. AST field on `Program`  
4. IR field + `buildIR` mapping  
5. FFmpeg (+ legacy) codegen  
6. Tests + scaffold intent if common  
