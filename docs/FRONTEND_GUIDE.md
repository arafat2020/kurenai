# Kurenai — Frontend Integration Guide
### In-Browser Video Processing with WebCodecs & Mediabunny

---

## 1. Overview

Kurenai is a domain-specific language (DSL) compiler for video transformation pipelines. With the **Target Dispatch Architecture**, Kurenai supports two primary compilation targets:

1. **Server Target (`ffmpeg`)**: Compiles `.crn` scripts into FFmpeg CLI commands executed on your server / BullMQ queue.
2. **Browser Target (`webcodecs`)**: Compiles `.crn` scripts into a data plan (`WebCodecsPipelinePlan`) executed directly inside the user's web browser using **Mediabunny** and the hardware-accelerated **WebCodecs API**.

### Why process video client-side?
- **Zero Server Cost**: Video encoding uses the client's GPU/CPU.
- **Instant Processing**: No uploading multi-gigabyte video files to cloud storage before processing.
- **Privacy First**: Sensitive video files stay inside the user's browser tab.

---

## 2. Installation & Package Exports

Install the Kurenai compiler and Mediabunny in your frontend project:

```bash
npm install @arafat2020/kurenai mediabunny
```

### Import Rules

Always import browser execution utilities from `@arafat2020/kurenai/browser`:

```ts
// 1. Target-dispatch compiler (works anywhere)
import { compileTarget, type CompileOutput } from "@arafat2020/kurenai";

// 2. Browser utilities (WebCodecs encoder capability check & Mediabunny execution engine)
import {
  checkWebCodecsCapability,
  executeWebCodecsPipeline,
  type ExecutionProgress,
} from "@arafat2020/kurenai/browser";
```

> **Why the subpath import matters:** Importing from `@arafat2020/kurenai/browser` ensures `mediabunny` is only bundled for frontend applications, leaving Node.js/backend server bundles lean and free of unnecessary web dependencies.

---

## 3. Step-by-Step Integration Workflow

```
       DSL Script (.crn)
               │
               ▼
     compileTarget(source)
               │
               ▼
     WebCodecsPipelinePlan
               │
               ▼
 checkWebCodecsCapability(plan)
       │               │
  (Supported)    (Not Supported)
       │               │
       │               └─► Fallback: Submit to Server FFmpeg Queue
       ▼
executeWebCodecsPipeline(plan, file, onProgress)
       │
       ▼
Uint8Array Video Bytes ──► Blob ──► <video src=...> or Download Link
```

### Step 1: Compile the DSL Script
Pass your `.crn` DSL string to `compileTarget(script)`. When running in a browser environment, Kurenai automatically auto-detects `"browser"` and selects the `"webcodecs"` target:

```ts
const script = `
  input "user_video.mp4"
  resize 1280x720
  fps 30
  encode h264 aac
  bitrate 2M
  output "processed.mp4"
`;

const result = compileTarget(script);
// result.target === "webcodecs"
// result.plan contains the structured WebCodecs execution plan
```

### Step 2: Check Hardware Capability (Pre-Flight Check)
Browsers and OS drivers differ in supported hardware encoders (e.g. H.264 vs VP9 vs AV1). Run `checkWebCodecsCapability()` before starting conversion:

```ts
if (result.target === "webcodecs") {
  const capability = await checkWebCodecsCapability(result.plan);
  
  if (!capability.supported) {
    console.warn("Browser cannot encode requested codec:", capability.reason);
    // Fall back to server queue (see Step 3)
    return submitToServerWorker(script, userFile);
  }
}
```

### Step 3: Execute the Video Pipeline in Browser
Pass the `result.plan` and the user's selected `File` or `Blob` to `executeWebCodecsPipeline`:

```ts
const [output] = await executeWebCodecsPipeline(
  result.plan,
  userFile,
  ({ ratio, processedSeconds }: ExecutionProgress) => {
    console.log(`Progress: ${(ratio * 100).toFixed(1)}% (${processedSeconds.toFixed(1)}s encoded)`);
  }
);

// output.data is a Uint8Array containing encoded video bytes
const blob = new Blob([output.data], { type: "video/mp4" });
const previewUrl = URL.createObjectURL(blob);
```

---

## 4. Production Code Examples

### React Component (TypeScript)

```tsx
import React, { useState } from "react";
import { compileTarget } from "@arafat2020/kurenai";
import {
  checkWebCodecsCapability,
  executeWebCodecsPipeline,
} from "@arafat2020/kurenai/browser";

export function KurenaiVideoExporter() {
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [status, setStatus] = useState<string>("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const handleProcess = async () => {
    if (!file) return;
    setIsProcessing(true);
    setProgress(0);
    setStatus("Compiling DSL script...");

    try {
      const crnScript = `
        input "${file.name}"
        resize 1280x720
        fps 30
        encode h264 aac
        bitrate 2.5M
        output "exported.mp4"
      `;

      // 1. Compile DSL (Auto-selects 'webcodecs' in browser)
      const result = compileTarget(crnScript);
      if (result.target !== "webcodecs") return;

      // 2. Pre-flight hardware capability check
      setStatus("Checking hardware encoder support...");
      const cap = await checkWebCodecsCapability(result.plan);
      
      if (!cap.supported) {
        setStatus(`Browser unsupported (${cap.reason}). Sending to server...`);
        // Fallback to server API
        await sendToServer(crnScript, file);
        return;
      }

      // 3. Execute client-side conversion
      setStatus("Processing video in browser...");
      const [output] = await executeWebCodecsPipeline(
        result.plan,
        file,
        ({ ratio }) => setProgress(Math.round(ratio * 100))
      );

      // 4. Create preview blob URL
      const blob = new Blob([output.data], { type: "video/mp4" });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setStatus("Processing Complete!");
    } catch (err) {
      console.error(err);
      setStatus(`Error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h2>Kurenai Video Exporter</h2>
      
      <input
        type="file"
        accept="video/*"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
      />

      <button
        onClick={handleProcess}
        disabled={!file || isProcessing}
        style={{ marginLeft: "10px" }}
      >
        {isProcessing ? `Processing (${progress}%)` : "Export Video"}
      </button>

      {status && <p><strong>Status:</strong> {status}</p>}

      {videoUrl && (
        <div style={{ marginTop: "20px" }}>
          <h3>Processed Result:</h3>
          <video src={videoUrl} controls width="640" />
          <br />
          <a href={videoUrl} download="processed_video.mp4">
            Download Processed Video
          </a>
        </div>
      )}
    </div>
  );
}
```

---

### Vue 3 (`<script setup>`) Example

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { compileTarget } from '@arafat2020/kurenai';
import {
  checkWebCodecsCapability,
  executeWebCodecsPipeline
} from '@arafat2020/kurenai/browser';

const selectedFile = ref<File | null>(null);
const progress = ref(0);
const statusMessage = ref('');
const resultUrl = ref<string | null>(null);

async function processVideo() {
  if (!selectedFile.value) return;
  statusMessage.value = 'Compiling script...';

  const script = `
    input "${selectedFile.value.name}"
    resize 1920x1080
    fps 60
    encode h264 aac
    bitrate 4M
    output "hd_output.mp4"
  `;

  const result = compileTarget(script);
  if (result.target !== 'webcodecs') return;

  const cap = await checkWebCodecsCapability(result.plan);
  if (!cap.supported) {
    statusMessage.value = `Hardware unsupported: ${cap.reason}`;
    return;
  }

  statusMessage.value = 'Rendering video...';
  const [output] = await executeWebCodecsPipeline(
    result.plan,
    selectedFile.value,
    ({ ratio }) => {
      progress.value = Math.round(ratio * 100);
    }
  );

  const blob = new Blob([output.data], { type: 'video/mp4' });
  resultUrl.value = URL.createObjectURL(blob);
  statusMessage.value = 'Finished!';
}
</script>

<template>
  <div class="video-processor">
    <input type="file" @change="e => selectedFile = (e.target as HTMLInputElement).files?.[0] || null" />
    <button @click="processVideo" :disabled="!selectedFile">Process Video</button>
    <p v-if="statusMessage">{{ statusMessage }} ({{ progress }}%)</p>
    <video v-if="resultUrl" :src="resultUrl" controls width="640"></video>
  </div>
</template>
```

---

## 5. Compatibility & Feature Support Matrix

| Feature | Server Target (`ffmpeg`) | Browser Target (`webcodecs`) | Behavior / Note |
|---|---|---|---|
| **Output Containers** | MP4, WebM, MKV, AVI, MOV, FLV | **MP4, WebM** | WebCodecs limits outputs to browser-writable formats |
| **Video Codecs** | H.264, H.265, VP8, VP9, AV1, MPEG2 | **H.264 (`avc`), VP9 (`vp09`), VP8, AV1** | Mapped automatically; verified via `checkWebCodecsCapability()` |
| **Audio Codecs** | AAC, MP3, Opus, Vorbis, FLAC, PCM | **AAC, MP3, Opus, Vorbis, FLAC** | Mapped automatically |
| **Resize & FPS** | Scale filter & FPS filter | **Hardware scaling via Canvas/Encoder** | `width`, `height`, `frameRate` set directly on WebCodecs encoder |
| **Bitrate Control** | `-b:v` flag | **bps integer value** | Automatically converted from `"2M"` → `2000000` |
| **V2 Multi-Clip Scripts** | Concat assembly & mix tracks | **Not Supported** | Throws `CompilerError` asking to compile with `{ target: "ffmpeg" }` |
| **Thumbnails** | Extracted frame image | **Skipped** | Emits a console warning and skips frame extraction |

---

## 6. Best Practices & Memory Optimization

1. **Clean up Object URLs**: Call `URL.revokeObjectURL(url)` when preview components unmount to release browser GPU/RAM resources.
2. **Set File Size Limits**: Use WebCodecs for files under **500 MB**. For large videos (multi-gigabyte exports), route the `.crn` script to your server FFmpeg queue.
3. **Always Run Pre-Flight Checks**: Use `checkWebCodecsCapability()` on file select so visitors with older devices receive a seamless fallback message.
