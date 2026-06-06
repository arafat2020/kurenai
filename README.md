# Kurenai

**Kurenai** is a lightweight, human-readable Domain Specific Language (DSL) and compiler for generating FFmpeg commands. It allows you to write clean, maintainable video processing pipelines without having to remember complex FFmpeg arguments and filtergraph syntax.

## Features

* **Human-readable syntax**
  Define video transformations using simple, declarative scripts without boilerplate.

* **FFmpeg Code Generation**
  Automatically generates optimized and syntactically correct FFmpeg commands.

* **Built-in Execution**
  Run your generated commands directly on your system using the CLI.

* **Video & Image Processing**
  Out-of-the-box support for resizing, changing FPS, encoding, watermarking, and extracting thumbnails.

## Installation

You can install Kurenai globally via npm:

```bash
npm install -g kurenai
```

*(Note: Ensure you have `ffmpeg` installed on your system if you intend to execute the generated commands)*

## Usage

Create a script file with a `.crn` extension (e.g., `pipeline.crn`):

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

### CLI Commands

Kurenai provides three main CLI commands to interact with your scripts:

1. **`validate`**: Runs the lexer, parser, and analyzer to verify the syntax of your script without generating code.
   ```bash
   kurenai validate pipeline.crn
   ```

2. **`compile`**: Compiles your script and prints the generated FFmpeg command(s) to the console.
   ```bash
   kurenai compile pipeline.crn
   ```
   *Add the `--verbose` flag to see a detailed breakdown of the compilation stages (Lexing, Parsing, Analyzing, Generating).*

3. **`run`**: Compiles the script and immediately executes the generated FFmpeg command(s) on your system.
   ```bash
   kurenai run pipeline.crn
   ```

## Language Syntax Guide

A Kurenai script is composed of simple keywords and values. Here are the supported operations:

### `input`
Specifies the input video file.
```kurenai
input "video.mp4"
```

### `output`
Specifies the final output video file.
```kurenai
output "final_video.mp4"
```

### `resize`
Scales the video to the specified resolution (`width`x`height`). Both dimensions must be divisible by 2.
```kurenai
resize 1920x1080
```

### `fps`
Changes the frame rate of the video. Must be a positive integer between 1 and 240.
```kurenai
fps 60
```

### `encode`
Sets the video and audio codecs. Supported video codecs include `h264`, `h265`, `vp8`, `vp9`, `av1`, `mpeg2video`, and `theora`.
```kurenai
encode h264 aac
```

### `bitrate`
Sets the video bitrate.
```kurenai
bitrate 5000k
```

### `watermark`
Overlays an image on the video. Supported positions: `top-left`, `top-right`, `bottom-left`, `bottom-right`, `center`.
```kurenai
watermark "logo.png" bottom-right
```

### `thumbnail`
Extracts a single frame as a thumbnail image at the specified time. This automatically generates a separate FFmpeg command.
```kurenai
thumbnail 10s
```

## Example

**`example.crn`**
```kurenai
input "raw_footage.mkv"
resize 1280x720
fps 30
encode h264 aac
bitrate 2500k
watermark "watermark.png" top-left
thumbnail 2s
output "processed_footage.mp4"
```

**Running `kurenai compile example.crn` generates:**
```bash
ffmpeg -i raw_footage.mkv -vf "scale=1280:720,fps=30" -c:v libx264 -c:a aac -b:v 2500k -i watermark.png -filter_complex "overlay=10:10" processed_footage.mp4
ffmpeg -i raw_footage.mkv -ss 2 -frames:v 1 thumb.jpg
```

## License

This project is licensed under the [MIT License](LICENSE).
