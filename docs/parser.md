# Kurenai Parser Documentation

This document explains how the Kurenai parser works (`src/parser.ts`), making it easier to maintain and understand. 

The parser's job is to take a flat list of **Tokens** (produced by the Lexer) and structure them into an **Abstract Syntax Tree (AST)** called the `Program`.

## 1. Abstract Syntax Tree (AST)

The output of the parser is a `Program` object containing various nodes. Every node inherits from a base `ASTNode` interface.

```typescript
interface ASTNode {
    type: string;
    line: number; // The line number where this node was defined
}
```

### The `Program` Object
The root of the parsed AST is the `Program` object. It contains mandatory input/output nodes, optional configuration nodes (like filters and encoding settings), and a dictionary of reusable profiles.

```typescript
interface Program extends ASTNode {
    input: InputNode;
    output: OutputNode;
    resize?: ResizeNode;
    fps?: FpsNode;
    encode?: EncodeNode;
    bitrate?: BitrateNode;
    audio?: AudioNode;
    watermark?: WatermarkNode;
    thumbnail?: ThumbnailNode;
    profiles: Record<string, ProfileNode>;
}
```

## 2. Core Parsing Architecture

The main entry point for the parser is the `parseTokens(tokens: Token[])` function. 

### The Main Loop
The parser uses a `while` loop to iterate through the tokens. When it encounters a `KEYWORD` token (e.g., `input`, `resize`), it delegates the parsing of that command to a specialized helper function: `parseCommand`.

### The `parseCommand` Helper
```typescript
function parseCommand(
    keyword: string,
    tokens: Token[],
    i: number,
    target: Partial<Program>
): number
```
To support reusable components like `profile`, the parsing logic for commands is encapsulated in `parseCommand`. 
* **`target`**: This is the object where the parsed command data should be stored. 
  * When parsing the main file, `target` is the root `Program` object.
  * When parsing inside a `profile { ... }` block, `target` is a temporary `profileBody` object.
* **Return Value**: It returns the updated index `i` of the token array, effectively skipping over the arguments consumed by the command.

## 3. Supported Keywords and Syntax

Below are the commands the parser recognizes.

> [!NOTE]
> All strings (like file paths) require double quotes `""`.

| Keyword | Arguments | Example | Description |
|---|---|---|---|
| `input` | `STRING` | `input "video.mp4"` | The source video file. |
| `output` | `STRING` | `output "out.mp4"` | The destination file path. |
| `resize` | `RESOLUTION` | `resize 1920x1080` | Resizes the video to WIDTHxHEIGHT. |
| `fps` | `NUMBER` | `fps 30` | Sets the frames per second. |
| `encode` | `IDENTIFIER` `IDENTIFIER` | `encode h264 aac` | Specifies video and audio codecs. |
| `bitrate` | `BITRATE` | `bitrate 500k` | Target video bitrate. |
| `audio` | `IDENTIFIER` | `audio "track.mp3"` | An external audio track to mix in. |
| `watermark` | `STRING` `IDENTIFIER` | `watermark "logo.png" top-left`| Adds an image watermark to a specified position. |
| `thumbnail` | `TIME` | `thumbnail 5s` | Extracts a thumbnail at the specified timestamp. |

## 4. Profiles (`profile` and `use`)

To avoid repeating the same configurations for multiple videos, the parser supports named **Profiles**.

### Defining a Profile
When the parser encounters the `profile` keyword:
1. It expects an `IDENTIFIER` (the profile name) followed by an `LBRACE` (`{`).
2. It loops through the inner tokens, recursively calling `parseCommand`, passing a temporary `profileBody` object as the target.
3. Once the `RBRACE` (`}`) is encountered, the parsed profile body is stored in `program.profiles[name]`.

```kurenai
profile youtube_1080p {
    resize 1920x1080
    fps 60
    encode h264 aac
}
```

### Applying a Profile with `use`
When the parser encounters the `use` keyword:
1. It looks up the requested profile in `program.profiles`. If missing, it throws an error.
2. It iterates through the fields in the `profile.body` and copies them into the current `target`.

> [!TIP]
> **Precedence Rules:** The `use` command is explicitly designed so that **inline configurations always win**. When `use` copies fields into the target, it checks `if (!(key in target))`. This guarantees that if you defined an inline `resize 1280x720` before or after the `use` statement, the profile will *not* overwrite your custom resize value.
