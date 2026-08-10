# Kurenai

Kurenai is a lightweight Domain Specific Language (DSL) and compiler for generating FFmpeg commands.

Instead of memorizing complex FFmpeg flags and filter graphs, you describe your media processing pipeline using a clean, human-readable syntax and let Kurenai generate the commands for you — whether you're processing video, audio, or both.

---

## Features

* Human-readable DSL for video **and audio** processing
* Generates valid FFmpeg commands
* CLI and TypeScript API
* Time-range (chunked) rendering support
* Built-in semantic validation
* **Audio-first support** — process podcasts, music, and audio files without any video
* **Full audio block** — codec, bitrate, sample rate, channels, normalization, EQ, compression, reverb, fade in/out
* **Audio-only inputs** — `.mp3` `.wav` `.aac` `.flac` `.ogg` `.m4a` `.opus` `.wma` `.aiff`
* Profile system for reusable configurations
* Watermark and thumbnail support
* Video resizing and frame rate conversion
* Codec and bitrate configuration
* **V2 mode** — multi-source timelines, named clips, and audio volume mixing
* Multi-stage compiler architecture (Lexer → Parser → Analyzer → Codegen)
* **Target-Dispatch Architecture** — target `ffmpeg` for servers or `webcodecs` for client-side processing
* **In-Browser Video Processing** — zero server-cost video encoding directly in the browser via WebCodecs & Mediabunny
* **Pre-Flight Hardware Capability Check** — test client GPU/browser encoder support with `checkWebCodecsCapability()`
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

Kurenai generates FFmpeg commands. To execute them you must have FFmpeg installed:

```bash
ffmpeg -version
```

---

# Quick Examples

## Video Processing

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

**Generated:**

```bash
ffmpeg -i input.mp4 \
  -vf "scale=1280:720,fps=30" \
  -c:v libx264 -c:a aac \
  -b:v 3000k \
  -i logo.png -filter_complex "overlay=main_w-overlay_w-10:main_h-overlay_h-10" \
  output.mp4

ffmpeg -i input.mp4 -ss 5 -frames:v 1 thumb.jpg
```

---

## Audio-Only Processing

No video required. Pass an audio file as input and Kurenai will skip all video filters automatically.

```kurenai
input "podcast.mp3"

audio {
  normalize -14 LUFS
  codec aac
  bitrate 192k
}

output "podcast_mastered.mp3"
```

**Generated:**

```bash
ffmpeg -i podcast.mp3 \
  -c:a aac \
  -b:a 192k \
  -af "loudnorm=I=-14" \
  podcast_mastered.mp3
```

---

## Full Audio Block — Video with Advanced Audio

```kurenai
input "video.mp4"

audio {
  codec aac
  bitrate 192k
  samplerate 48000
  channels stereo
  normalize -14 LUFS
  eq {
    bass +3db
    mid  -1db
    treble +2db
  }
  compress {
    threshold -18db
    ratio 4:1
    attack 5ms
    release 100ms
  }
  reverb subtle
  fadein  2s
  fadeout 3s
}

output "out.mp4"
```

**Generated:**

```bash
ffmpeg -i video.mp4 \
  -c:a aac -b:a 192k -ar 48000 -ac 2 \
  -af "loudnorm=I=-14,\
       equalizer=f=100:width_type=o:width=2:g=3,\
       equalizer=f=1000:width_type=o:width=2:g=-1,\
       equalizer=f=10000:width_type=o:width=2:g=2,\
       acompressor=threshold=-18dB:ratio=4:attack=5:release=100,\
       aecho=0.8:0.8:20:0.1,\
       afade=t=in:st=0:d=2,\
       afade=t=out:st=99999:d=3" \
  out.mp4
```

---

# Kurenai V2 — Multi-Source Timeline Mode

V2 extends the language with **named sources**, **time-ranged clips**, an **audio mix block**, and an **ordered timeline**. Enable V2 mode by placing `use v2` as the first line of your script.

All V1 keywords (`encode`, `bitrate`, `resize`, `fps`, `audio`, `watermark`, `thumbnail`, `output`, `profile`, `use`) remain fully supported and unchanged inside a V2 script.

---

## V2 Quick Example

```kurenai
use v2

# 1. Declare named input sources
source intro  "intro.mp4"
source main   "main.mp4"
source outro  "outro.mp4"
source music  "background.mp3"
source voice  "voiceover.mp3"

# 2. Cut clips from sources
clip c_intro from intro  0s to 10s
clip c_main  from main   5s to 45s
clip c_outro from outro  0s  to 8s

# 3. Define an audio mix (multiple tracks with per-track volume)
mix bg {
  track music volume 0.3
  track voice volume 1.0
}

# 4. Arrange clips into the final timeline
timeline {
  c_intro
  c_main
  c_outro
}

# 5. Apply global settings (same as V1)
encode  h264 aac
bitrate 8000k
audio   bg      # reference the mix by name

output "final.mp4"
```

**Generated commands:**

```bash
# Pass 1 — render each clip segment
ffmpeg -ss 0  -to 10 -i intro.mp4 -c:v libx264 -c:a aac -b:v 8000k segment_c_intro.mp4
ffmpeg -ss 5  -to 45 -i main.mp4  -c:v libx264 -c:a aac -b:v 8000k segment_c_main.mp4
ffmpeg -ss 0  -to 8  -i outro.mp4 -c:v libx264 -c:a aac -b:v 8000k segment_c_outro.mp4

# Pass 2 — concatenate segments and mix audio  (write segments.txt first)
ffmpeg -f concat -safe 0 -i segments.txt \
  -i background.mp3 -i voiceover.mp3 \
  -filter_complex "[1:a]volume=0.3[music];[2:a]volume=1[voice];[music][voice]amix=inputs=2:duration=longest[aout]" \
  -map 0:v -c:v copy -map [aout] -c:a aac \
  final.mp4
```

---

# In-Browser Video Processing (WebCodecs)

Kurenai can compile `.crn` scripts into structured execution plans (`WebCodecsPipelinePlan`) that execute **directly inside the browser** using WebCodecs & [Mediabunny](https://github.com/mediabunny).

### Benefits
- **Zero Server Cost**: Client GPU/CPU renders the video.
- **Privacy First**: Video files never leave the user's browser.
- **Instant Start**: No multi-gigabyte uploads to cloud servers.

### Basic Browser Example

```ts
import { compileTarget } from "@arafat2020/kurenai";
import {
  checkWebCodecsCapability,
  executeWebCodecsPipeline,
} from "@arafat2020/kurenai/browser";

// 1. Compile script (auto-detects 'browser' -> target: 'webcodecs')
const result = compileTarget(`
  input "user_video.mp4"
  resize 1280x720
  fps 30
  encode h264 aac
  bitrate 2.5M
  output "output.mp4"
`);

if (result.target === "webcodecs") {
  // 2. Pre-flight hardware encoder capability check
  const cap = await checkWebCodecsCapability(result.plan);
  if (!cap.supported) {
    console.warn("Hardware encoder unsupported:", cap.reason);
    return fallbackToServer(result.plan);
  }

  // 3. Execute in-browser conversion
  const [output] = await executeWebCodecsPipeline(
    result.plan,
    inputFile, // File | Blob from <input type="file">
    ({ ratio }) => console.log(`Progress: ${(ratio * 100).toFixed(0)}%`)
  );

  // output.data is Uint8Array video bytes
  const blob = new Blob([output.data], { type: "video/mp4" });
  videoElem.src = URL.createObjectURL(blob);
}
```

For React/Vue integration examples, memory optimization, and compatibility matrices, see the complete [**Frontend Integration Guide**](docs/FRONTEND_GUIDE.md).

---

## V2 Language Reference

### `use v2`

Must be the **first line** of the script. Activates the V2 parser and code generator.

```kurenai
use v2
```

---

### `source`

Declares a named input file. The name is used by `clip` and `mix` statements.

```
source NAME "file.ext"
```

```kurenai
source intro "intro.mp4"
source music "background.mp3"
```

Supported video formats: `.mp4` `.avi` `.mkv` `.mov` `.flv` `.wmv` `.webm` `.mpeg` `.mpg` `.m4v`

Supported audio formats: `.mp3` `.wav` `.aac` `.flac` `.ogg` `.m4a` `.opus` `.wma` `.aiff`

---

### `clip`

Cuts a time range from a named source and assigns it a clip name.

```
clip NAME from SOURCE STARTs to ENDs
```

```kurenai
clip c_intro from intro 0s  to 10s
clip c_main  from main  5s  to 45s
clip c_outro from outro 0s  to 8s
```

| Part | Type | Description |
|---|---|---|
| `NAME` | identifier | Unique name for this clip |
| `SOURCE` | identifier | Name of a declared `source` |
| `START` / `END` | time (e.g. `5s`) | Start and end timestamps |

---

### `mix`

Defines a named audio mix containing one or more tracks, each with an independent volume multiplier.

```
mix NAME {
  track SOURCE volume N.NN
  ...
}
```

```kurenai
mix bg {
  track music volume 0.3   # 30% volume
  track voice volume 1.0   # full volume
}
```

| Part | Type | Description |
|---|---|---|
| `NAME` | identifier | Unique name for this mix |
| `SOURCE` | identifier | Name of a declared `source` |
| `N.NN` | float | Volume multiplier (e.g. `0.3`, `1.0`) |

Reference a mix in the `audio` keyword by its name:

```kurenai
audio bg
```

---

### `timeline`

Declares the ordered sequence of clips that will be concatenated into the final output.

```
timeline {
  CLIP_NAME
  CLIP_NAME
  ...
}
```

```kurenai
timeline {
  c_intro
  c_main
  c_outro
}
```

---

## V2 Code Generation — Two-Pass Strategy

| Pass | What it does |
|---|---|
| **Pass 1** | One `ffmpeg -ss … -to … -i SOURCE` command per clip in timeline order, producing `segment_CLIP.mp4` files |
| **Pass 2** | One `ffmpeg -f concat` command per `output` statement; audio tracks from a `mix` block are composed via `-filter_complex amix` |
| **Pass 3** | Optional `ffmpeg -ss … -frames:v 1` thumbnail extraction from the first output |

---

## V2 Semantic Rules

The analyzer enforces these rules and throws a `CompilerError` on any violation:

| Rule | Error message |
|---|---|
| At least one `source` declared | "At least one source is required." |
| At least one `output` declared | "Output file is missing." |
| `timeline` present when clips are defined | "Timeline is required when clips are defined." |
| Source file format is supported | "Unsupported source format: …" |
| `clip` references a declared `source` | `Clip "X" references unknown source "Y"` |
| Clip cannot reference itself as source | `Clip "X" cannot reference itself as a source` |
| Clip `start` < `end` | `Clip "X" start must be less than end` |
| Mix `track` references a declared `source` | `Track in mix "X" references unknown source "Y"` |
| `timeline` references declared clips only | `Timeline references unknown clip "X"` |
| `audio NAME` references a declared mix | `Audio mix "X" not found` |

---

# CLI Usage

## Validate

Runs Lexing → Parsing → Semantic Analysis without generating commands.

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

## Explain

Prints a human-readable breakdown of the compilation result.

```bash
kurenai explain pipeline.crn
```

V2 output example:

```text
Sources:
  ✓ intro: intro.mp4
  ✓ music: background.mp3

Clips:
  ✓ c_intro from intro (0s to 10s)

Mixes:
  ✓ bg: [music (vol: 0.3), voice (vol: 1)]

Timeline:
  ✓ c_intro → c_main → c_outro

Encoding:
  ✓ video codec: h264 → libx264
  ✓ audio codec: aac
```

---

## Run

Compiles and executes generated FFmpeg commands.

```bash
kurenai run pipeline.crn
```

---

# Language Reference (V1)

---

## `input`

```kurenai
input "video.mp4"
input "podcast.mp3"
```

Supported video formats: `.mp4` `.avi` `.mkv` `.mov` `.flv` `.wmv` `.webm` `.mpeg` `.mpg` `.m4v`

Supported audio formats: `.mp3` `.wav` `.aac` `.flac` `.ogg` `.m4a` `.opus` `.wma` `.aiff`

---

## `output`

```kurenai
output "final.mp4"
```

Multiple outputs with per-output overrides:

```kurenai
output "youtube.mp4"  { resize 1920x1080 }
output "mobile.mp4"   { resize 720x1280  }
```

Supported video formats: `.mp4` `.avi` `.mkv` `.mov` `.flv` `.wmv` `.webm` `.mpeg` `.mpg` `.m4v`

Supported audio formats: `.mp3` `.wav` `.aac` `.flac` `.ogg` `.m4a` `.opus` `.wma` `.aiff`

---

## `audio` — Audio Block

The `audio` block configures all audio processing in one place. Every property is optional; include only what you need.

```kurenai
audio {
  file       "bg_music.mp3"   # mix in an external audio track
  codec      aac
  bitrate    192k
  samplerate 48000
  channels   stereo           # stereo | mono

  normalize -14 LUFS          # LUFS | dbtp | dbrms

  eq {
    bass   +3db
    mid    -1db
    treble +2db
  }

  compress {
    threshold -18db
    ratio     4:1
    attack    5ms
    release   100ms
  }

  reverb  subtle              # subtle | medium | large
  fadein  2s
  fadeout 3s
}
```

### Audio Properties

| Property | Values | FFmpeg mapping |
|----------|--------|----------------|
| `file` | `"path.mp3"` | `-i path.mp3` + `amix` |
| `codec` | `aac` `mp3` `opus` `vorbis` | `-c:a` |
| `bitrate` | `128k` `192k` `320k` … | `-b:a` |
| `samplerate` | `44100` `48000` … | `-ar` |
| `channels` | `stereo` `mono` | `-ac 2` / `-ac 1` |
| `normalize` | `-14 LUFS` `-1 dbtp` `7 dbrms` | `loudnorm` filter |
| `eq.bass` | `+3db` `-3db` … | `equalizer f=100` |
| `eq.mid` | `+3db` `-3db` … | `equalizer f=1000` |
| `eq.treble` | `+3db` `-3db` … | `equalizer f=10000` |
| `compress.threshold` | `-18db` … | `acompressor threshold=` |
| `compress.ratio` | `4:1` `8` … | `acompressor ratio=` |
| `compress.attack` | `5ms` `10` … | `acompressor attack=` |
| `compress.release` | `100ms` `200` … | `acompressor release=` |
| `reverb` | `subtle` `medium` `large` | `aecho` filter |
| `fadein` | `2s` `500ms` | `afade t=in` |
| `fadeout` | `3s` `500ms` | `afade t=out` |

---

## `resize`

```kurenai
resize 1920x1080
```

Scales the video. Width and height must each be divisible by 2. Ignored automatically when the input is an audio file.

---

## `fps`

```kurenai
fps 60
```

Changes frame rate. Allowed range: `1 – 240`. Ignored automatically when the input is an audio file.

---

## `encode`

```kurenai
encode h264 aac
```

Supported video codecs:

```text
h264  h265  vp8  vp9  av1  mpeg2video  theora
```

Supported audio codecs:

```text
aac  mp3  opus  vorbis
```

---

## `bitrate`

```kurenai
bitrate 5000k
```

Sets video bitrate (use the `audio` block for audio bitrate).

---

## `watermark`

```kurenai
watermark "logo.png" bottom-right
```

Supported positions:

```text
top-left  top-right  bottom-left  bottom-right  center
```

---

## `thumbnail`

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

Inline values always take precedence over profile defaults.

```kurenai
use youtube_1080p

fps 30

input "video.mp4"
output "output.mp4"
```

Result: Resolution `1920x1080`, FPS `30`, Codec `h264`.

---

# TypeScript API

---

## Compile (V1)

```ts
import { compile } from "@arafat2020/kurenai";

const { commands } = compile(`
  input "podcast.mp3"

  audio {
    normalize -14 LUFS
    codec aac
    bitrate 192k
  }

  output "podcast_mastered.mp3"
`);

// commands[0] → 'ffmpeg -i podcast.mp3 -c:a aac -b:a 192k -af "loudnorm=I=-14" podcast_mastered.mp3'
```

---

## Compile (V2)

```ts
import { compile, type ProgramV2 } from "@arafat2020/kurenai";

const { ast, commands } = compile(`
  use v2

  source intro "intro.mp4"
  source music "bg.mp3"

  clip c_intro from intro 0s to 10s

  mix bg {
    track music volume 0.5
  }

  timeline { c_intro }

  encode h264 aac
  audio  bg
  output "final.mp4"
`);

const v2 = ast as ProgramV2;
console.log(Object.keys(v2.sources));  // ['intro', 'music']
console.log(v2.timeline?.clips);       // ['c_intro']
console.log(commands);                 // Pass-1 + Pass-2 FFmpeg commands
```

---

## Target-Dispatch Compile (`compileTarget`)

`compileTarget()` auto-detects the runtime environment or accepts an explicit `{ target }` option:

```ts
import { compileTarget, type CompileOutput } from "@arafat2020/kurenai";

// 1. Auto-detect environment ('node' -> 'ffmpeg', 'browser' -> 'webcodecs')
const result = compileTarget(source);

// 2. Or pass an explicit target
const ffmpegResult = compileTarget(source, { target: "ffmpeg" });
const webcodecsResult = compileTarget(source, { target: "webcodecs" });

if (result.target === "ffmpeg") {
  console.log(result.commands); // string[]
} else {
  console.log(result.plan);     // WebCodecsPipelinePlan
}
```

---

## Browser Subpath Export (`@arafat2020/kurenai/browser`)

Import browser-specific WebCodecs tools without bloating Node.js server bundles:

```ts
import {
  checkWebCodecsCapability,
  executeWebCodecsPipeline,
  detectEnvironment,
  resolveTarget,
} from "@arafat2020/kurenai/browser";
```

---

## Individual Pipeline Stages

```ts
import { lex, parse, analyzeAst, generateCommands } from "@arafat2020/kurenai";

const tokens   = lex(source);
const ast      = parse(tokens);       // returns Program | ProgramV2
analyzeAst(ast);                      // throws CompilerError on failure
const commands = generateCommands(ast);
```

---

## Kurenai Class

```ts
import { Kurenai } from "@arafat2020/kurenai";

const k = new Kurenai();

// Full pipeline
const { commands } = k.compile(source);

// Validate only (no codegen)
k.validate(source);

// Human-readable breakdown to stdout (works for both V1 and V2)
k.explain(source);

// Compile + execute FFmpeg (Node.js only)
k.run(source);
```

Throws a `CompilerError` if validation fails.

---

# Compiler Pipeline

```text
Source (.crn)
    ↓
  Lexer           — tokenises keywords, strings, numbers, time, dB, floats, etc.
    ↓
  Parser          — builds a typed AST
    ↓               V1: Program    (src/core/*Parser.ts)
    ↓               V2: ProgramV2  (src/core/SourceParser, ClipParser,
    ↓                               MixParser, TimelineParser  + all V1 parsers)
  Analyzer        — validates formats, dimensions, codecs, FPS range,
    ↓               clip references, time ranges, mix track sources
  Code Generator  — translates AST nodes to FFmpeg flag sequences
    ↓               V2: two-pass strategy (clip segments → concat + amix)
FFmpeg Commands
```

---

# Error Handling

All compilation errors throw a `CompilerError` with `message`, `line`, `column`, and `length` properties.

```ts
import { compile, CompilerError } from "@arafat2020/kurenai";

try {
  compile(source);
} catch (err) {
  if (err instanceof CompilerError) {
    console.error(`Error at line ${err.line}: ${err.message}`);
  }
}
```

The CLI displays the error with an underline pointing to the exact token:

```text
Error on line 3:
  clip c_intro from unknown 0s to 10s
                    ^^^^^^^
  Clip "c_intro" references unknown source "unknown"
```

---

# License

MIT License.
