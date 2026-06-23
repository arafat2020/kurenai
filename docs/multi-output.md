# Multi-Output Support in Kurenai

Kurenai has been updated to support defining **multiple outputs** within a single script. This allows you to generate several different video formats, resolutions, or codec variants from a single input file without having to run multiple Kurenai scripts.

---

## How It Worked Before (Single Output)

Previously, Kurenai only supported a single `output` command at the end of the script. The entire script acted as a configuration block for that one specific output file.

**Old Syntax:**
```kurenai
input "video.mp4"

resize 1920x1080
fps 60
encode h264 aac

output "final.mp4"
```

If you wanted to generate a 720p version of the video for mobile devices, you had to write a completely separate Kurenai script and run it separately.

---

## How It Works Now (Multiple Outputs)

You can now specify the `output` keyword multiple times in the same script. Furthermore, the `output` keyword now supports an optional override block `{ ... }`. 

Inside this block, you can place configuration commands (like `resize`, `fps`, `encode`, etc.) that **override** the global script configuration exclusively for that specific output!

**New Syntax:**
```kurenai
input "video.mp4"

# Global configuration (applied to all outputs by default)
fps 60
encode h264 aac
watermark "logo.png" top-right

# Output 1: A 1080p desktop version inheriting global settings
output "desktop.mp4" {
    resize 1920x1080
}

# Output 2: A 720p mobile version, overriding the global resize AND fps
output "mobile.mp4" {
    resize 720x1280
    fps 30
}
```

### What Happens Under the Hood?

When Kurenai parses a script with multiple outputs, it evaluates the **global** configurations, merges them with the **local block overrides** for each output, and generates **separate FFmpeg commands** for each file.

For the example above, `kurenai compile` generates two completely independent and robust FFmpeg commands:
```bash
ffmpeg -i video.mp4 -vf "scale=1920:1080,fps=60" -c:v libx264 -c:a aac -i logo.png -filter_complex "overlay=main_w-overlay_w-10:10" desktop.mp4
ffmpeg -i video.mp4 -vf "scale=720:1280,fps=30" -c:v libx264 -c:a aac -i logo.png -filter_complex "overlay=main_w-overlay_w-10:10" mobile.mp4
```

### Benefits of the New Approach
1. **DRY (Don't Repeat Yourself):** Define your global encodings and inputs once, and spawn multiple tailored outputs easily.
2. **Safe Compilation:** Kurenai generates isolated FFmpeg commands for each output. This completely avoids FFmpeg's notoriously complex and error-prone `-filter_complex` output mapping issues that arise when generating multiple outputs in a single FFmpeg execution.
3. **Flexibility:** Profiles (`use profile_name`) can also be utilized inside an output block, bringing immense composability to your rendering pipeline.
