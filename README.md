# Kurenai

Kurenai is a lightweight Domain Specific Language (DSL) and compiler for generating FFmpeg commands.

Instead of memorizing complex FFmpeg flags and filter graphs, you can describe your video processing pipeline using a clean, human-readable syntax and let Kurenai generate the commands for you.

---

## Features

* Human-readable video processing DSL
* Generates valid FFmpeg commands
* CLI and TypeScript API
* Built-in semantic validation
* Profile system for reusable configurations
* Watermark support
* Thumbnail extraction
* Video resizing and frame rate conversion
* Codec and bitrate configuration
* Multi-stage compiler architecture
* Detailed compilation diagnostics

---

## Installation

### Global CLI

```bash
npm install -g @arafat2020/kurenai
```

### Project Dependency

```bash
npm install @arafat2020/kurenai
```

---

## Requirements

Kurenai generates FFmpeg commands.

To execute generated commands you must have FFmpeg installed:

```bash
ffmpeg -version
```

---

# Quick Example

### example.crn

```kurenai
input "input.mp4"

resize 1280x720
fps 30

encode h264 aac
bitrate 3000k

watermark "logo.png" bottom-right
thumbnail 5s

output "output.mp4"
```

### Generated Output

```bash
ffmpeg -i input.mp4 \
-vf "scale=1280:720,fps=30" \
-c:v libx264 \
-c:a aac \
-b:v 3000k \
output.mp4

ffmpeg -i input.mp4 \
-ss 5 \
-frames:v 1 \
thumb.jpg
```

---

# CLI Usage

## Validate

Runs:

1. Lexing
2. Parsing
3. Semantic Analysis

without generating commands.

```bash
kurenai validate pipeline.crn
```

---

## Compile

Generates FFmpeg commands.

```bash
kurenai compile pipeline.crn
```

Verbose mode:

```bash
kurenai compile pipeline.crn --verbose
```

Example output:

```text
[1/4] Lexing...
✓ 25 tokens

[2/4] Parsing...
✓ AST built

[3/4] Analyzing...
✓ Valid

[4/4] Generating...
✓ Done
```

---

## Run

Compiles and executes generated FFmpeg commands.

```bash
kurenai run pipeline.crn
```

---

# Language Reference

---

## Input

```kurenai
input "video.mp4"
```

### `output`
Specifies the final output video file(s). You can define multiple outputs and provide output-specific overrides inside a block `{ ... }`. This allows you to generate multiple formats or resolutions in one script!
```kurenai
output "final_video.mp4"
output "youtube.mp4" { 
    resize 1920x1080 
}
output "mobile.mp4" { 
    resize 720x1280 
}
```

Specifies the output file.

---

## Resize

```kurenai
resize 1920x1080
```

Scales the video.

Requirements:

* Width must be divisible by 2
* Height must be divisible by 2

---

## FPS

```kurenai
fps 60
```

Changes frame rate.

Allowed range:

```text
1 - 240
```

---

## Encode

```kurenai
encode h264 aac
```

Supported video codecs:

```text
h264
h265
vp8
vp9
av1
mpeg2video
theora
```

Supported audio codecs:

```text
aac
mp3
opus
vorbis
```

---

## Bitrate

```kurenai
bitrate 5000k
```

Sets video bitrate.

Examples:

```kurenai
bitrate 1000k
bitrate 2500k
bitrate 5000k
```

---

## Watermark

```kurenai
watermark "logo.png" bottom-right
```

Supported positions:

```text
top-left
top-right
bottom-left
bottom-right
center
```

---

## Thumbnail

```kurenai
thumbnail 10s
```

Generates an additional FFmpeg command that extracts a frame at the specified timestamp.

---

# Profiles

Profiles allow reusable encoding configurations.

---

## Define a Profile

```kurenai
profile youtube_1080p {
    resize 1920x1080
    fps 60
    encode h264 aac
}
```

---

## Use a Profile

```kurenai
use youtube_1080p

input "video.mp4"
output "output.mp4"
```

---

## Override Profile Values

Inline values always take precedence.

```kurenai
use youtube_1080p

fps 30

input "video.mp4"
output "output.mp4"
```

Result:

```text
Resolution: 1920x1080
FPS: 30
Codec: h264
```

---

# TypeScript API

Kurenai exposes both functional and class-based APIs.

---

## Compile

```ts
import { compile } from "@arafat2020/kurenai";

const result = compile(`
input "video.mp4"
resize 1280x720
encode h264 aac
bitrate 2500k
watermark "watermark.png" top-left
thumbnail 2s

output "processed_footage.mp4"
output "mobile_footage.mp4" {
    resize 720x1280
}
```

**Running `kurenai compile example.crn` generates:**
```bash
ffmpeg -i raw_footage.mkv -vf "scale=1280:720,fps=30" -c:v libx264 -c:a aac -b:v 2500k -i watermark.png -filter_complex "overlay=10:10" processed_footage.mp4
ffmpeg -i raw_footage.mkv -vf "scale=720:1280,fps=30" -c:v libx264 -c:a aac -b:v 2500k -i watermark.png -filter_complex "overlay=10:10" mobile_footage.mp4
ffmpeg -i raw_footage.mkv -ss 2 -frames:v 1 thumb.jpg
```

Throws a CompilerError if validation fails.

---

## Explain

```ts
const k = new Kurenai();

k.explain(source);
```

Prints a human-readable breakdown of the compilation result.

---

# Compiler Pipeline

Kurenai follows a traditional compiler architecture:

```text
Source
  ↓
Lexer
  ↓
Parser
  ↓
Semantic Analyzer
  ↓
Code Generator
  ↓
FFmpeg Commands
```

---

# Error Handling

All compilation errors throw a CompilerError.

```ts
import {
  compile,
  CompilerError
} from "@arafat2020/kurenai";

try {
  compile(source);
} catch (err) {
  if (err instanceof CompilerError) {
    console.error(err.message);
  }
}
```

---

# License

MIT License.
