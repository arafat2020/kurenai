# Kurenai

Kurenai is a lightweight Domain Specific Language (DSL) and compiler for generating FFmpeg commands.

Instead of memorizing complex FFmpeg flags and filter graphs, you describe your media processing pipeline using a clean, human-readable syntax and let Kurenai generate the commands for you — whether you're processing video, audio, or both.

---

## Features

* Human-readable DSL for video **and audio** processing
* Generates valid FFmpeg commands
* CLI and TypeScript API
* Built-in semantic validation
* **Audio-first support** — process podcasts, music, and audio files without any video
* **Full audio block** — codec, bitrate, sample rate, channels, normalization, EQ, compression, reverb, fade in/out
* **Audio-only inputs** — `.mp3`, `.wav`, `.aac`, `.flac`, `.ogg`, `.m4a`, `.opus`, `.wma`, `.aiff`
* Profile system for reusable configurations
* Watermark and thumbnail support
* Video resizing and frame rate conversion
* Codec and bitrate configuration
* Multi-stage compiler architecture (Lexer → Parser → Analyzer → Codegen)
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

## Run

Compiles and executes generated FFmpeg commands.

```bash
kurenai run pipeline.crn
```

---

# Language Reference

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

## `audio` — Audio Block _(new)_

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

## Compile

```ts
import { compile } from "@arafat2020/kurenai";

const commands = compile(`
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

Throws a `CompilerError` if validation fails.

---

## Explain

```ts
import { Kurenai } from "@arafat2020/kurenai";

const k = new Kurenai();
k.explain(source);
```

Prints a human-readable breakdown of the compilation result.

---

# Compiler Pipeline

```text
Source (.crn)
    ↓
  Lexer          — tokenises keywords, strings, numbers, time, dB values, etc.
    ↓
  Parser         — builds a typed Program AST
    ↓             (delegates each keyword to src/core/*Parser.ts)
  Analyzer       — validates formats, dimensions, codecs, FPS range
    ↓
  Code Generator — translates AST nodes to FFmpeg flag sequences
    ↓
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

---

# License

MIT License.
