# Error Handling in the Kurenai Compiler

This document explains how the Kurenai compiler detects, constructs, and reports errors to the user. Every error surfaces a **3-part message** with an exact location, a visual pointer, and a human-readable explanation.

```
Error on line 2:
  resize 99x
         ^^^
  Unknown token: 99x
```

---

## Table of Contents

1. [The Problem with Generic Errors](#1-the-problem-with-generic-errors)
2. [The CompilerError Class](#2-the-compilererror-class)
3. [Stage 1 — Lexer Errors](#3-stage-1--lexer-errors)
4. [Stage 2 — Parser Errors](#4-stage-2--parser-errors)
5. [Stage 3 — Analyzer Errors](#5-stage-3--analyzer-errors)
6. [Stage 4 — CLI Formatting (handleError)](#6-stage-4--cli-formatting-handleerror)
7. [How Location Metadata Flows](#7-how-location-metadata-flows)
8. [Error Reference Table](#8-error-reference-table)

---

## 1. The Problem with Generic Errors

Before this system was built, the compiler threw plain JavaScript `Error` objects:

```
Error: Resolution Value must be a valid source
```

This gives the user zero context:
- **Which line** is wrong?
- **Which part** of the line?
- **What should they write instead?**

The goal is to replace that with structured, located errors at every stage of the pipeline.

---

## 2. The `CompilerError` Class

**File:** [`src/errors.ts`](../src/errors.ts)

All compiler errors are instances of the custom `CompilerError` class, which extends the built-in `Error` with three extra fields:

```typescript
export class CompilerError extends Error {
    constructor(
        public override message: string, // What went wrong
        public line: number,             // 1-based source line number
        public column: number,           // 1-based start column of the bad token
        public length: number            // Character length of the bad token
    ) { ... }
}
```

| Field | Type | Description |
|---|---|---|
| `message` | `string` | Human-readable description of the problem |
| `line` | `number` | Which line the error is on (1-based) |
| `column` | `number` | Which character column the bad token starts at (1-based) |
| `length` | `number` | How many characters wide the bad token is (used for `^^^` underlines) |

By using a subclass, any `catch` block can distinguish between a `CompilerError` (with known position) and an unexpected runtime error, using `instanceof`:

```typescript
if (err instanceof CompilerError) {
    // We know exactly where in the source it went wrong
}
```

---

## 3. Stage 1 — Lexer Errors

**File:** [`src/lexer.ts`](../src/lexer.ts)

The lexer is the **first stage** of the compiler. It converts raw source text into a flat array of typed tokens.

### How Column Tracking Works

The old lexer split each line by whitespace with `line.split(/\s+/)`. This discards the original position information — once split, you can't know where `"99x"` started on the line.

The new lexer instead uses a **regular expression `exec()` loop**, which gives you the exact start index of every match:

```typescript
const tokenRegex = /([{}])|("[^"]*")|([^\s{}]+)/g;

while ((match = tokenRegex.exec(line)) !== null) {
    const word   = match[0];
    const column = match.index + 1;   // Convert 0-based index → 1-based column
    const length = word.length;
    // ...
}
```

`match.index` is the 0-based character offset from the start of the line, so adding 1 gives the human-readable 1-based column number.

### Token Interface

Every token now carries its location:

```typescript
export interface Token {
    type: TokenType;
    value: string;
    line: number;    // 1-based line number
    column: number;  // 1-based start column
    length: number;  // Character length of the token
}
```

### Lexer Error Example

When the lexer encounters a character sequence it cannot classify (e.g. `99x`), it throws a `CompilerError` immediately, with the precise position of the bad substring:

```typescript
throw new CompilerError(
    `Unknown token: ${word}`,
    lineNumber + 1,  // line
    column,          // column
    length           // length
);
```

```
Input:  "resize 99x"
          ^^^^^^ ^^^
          col 1  col 8, length 3
```

---

## 4. Stage 2 — Parser Errors

**File:** [`src/parser.ts`](../src/parser.ts)

The parser takes the token array from the lexer and builds the Abstract Syntax Tree (AST).

### ASTNode Location Fields

Because every token already carries `line`, `column`, and `length`, the parser can propagate this metadata into every AST node it creates. The base `ASTNode` interface was extended to include these fields:

```typescript
interface ASTNode {
    type: string;
    line: number;
    column: number;
    length: number;
}
```

When the parser creates an AST node, it reads the coordinates **from the relevant token** — specifically the problematic argument token, not the keyword token. This means the underline points to the bad value, not the command that preceded it.

```typescript
// "resize invalid" → error points at "invalid", not "resize"
target.resize = {
    type: "RESIZE",
    width: ...,
    height: ...,
    line:   nextResizeToken.line,
    column: nextResizeToken.column,
    length: nextResizeToken.length,
};
```

### Parser Error Example

When the parser sees a `resize` command followed by a token that isn't a `RESOLUTION`:

```typescript
if (nextResizeToken.type !== 'RESOLUTION') {
    throw new CompilerError(
        "Resolution Value must be a valid source. Eg 1280x720",
        nextResizeToken.line,
        nextResizeToken.column,
        nextResizeToken.length
    );
}
```

```
Input:  "resize invalid"
                ^^^^^^^
                col 8, length 7
```

### Error Targeting Strategy

The parser deliberately targets **the value token** rather than the keyword token for all argument errors. This gives the most useful underline:

| Situation | Token targeted |
|---|---|
| Missing argument (e.g. `fps` with no value) | The keyword token itself |
| Wrong type argument (e.g. `fps high`) | The argument token (`high`) |
| Missing profile name | The `profile` keyword |
| Unknown profile in `use` | The profile name token |
| Unclosed profile block | The opening `{` token |

---

## 5. Stage 3 — Analyzer Errors

**File:** [`src/analyzer.ts`](../src/analyzer.ts)

The analyzer runs **after** parsing. It validates the semantics of the AST — things that are structurally valid tokens but logically incorrect (e.g. a resize with odd dimensions that FFmpeg can't encode).

Because AST nodes carry `line`, `column`, and `length`, the analyzer can throw `CompilerError` pointing directly to the source location of the invalid value:

```typescript
function analyzeResize(resize: Program['resize']): void {
    if (!resize) return;
    if (resize.width % 2 !== 0 || resize.height % 2 !== 0) {
        throw new CompilerError(
            `Invalid resize values: ${resize.width}x${resize.height}. ` +
            `Width and height must be divisible by 2 for ffmpeg compatibility.`,
            resize.line,
            resize.column,
            resize.length
        );
    }
}
```

### Analyzer Error Examples

| Check | Error thrown |
|---|---|
| Input/output file has unsupported extension | Points to the filename token |
| FPS ≤ 0 or FPS > 240 | Points to the FPS value token |
| Width/height ≤ 0 | Points to the resolution token |
| Width/height not divisible by 2 | Points to the resolution token |
| Unsupported video/audio codec | Points to the encode span token |
| Empty watermark file path | Points to the watermark span token |
| Unsupported watermark position | Points to the watermark span token |

---

## 6. Stage 4 — CLI Formatting (`handleError`)

**File:** [`src/main.ts`](../src/main.ts)

The CLI entry point is the only place in the codebase that has direct access to the **original source text** (it reads the `.crn` file from disk). This is where `CompilerError` is caught and rendered into the human-readable 3-part output.

```typescript
function handleError(err: unknown, source: string, stage: string): void {
    if (err instanceof CompilerError) {
        const lines   = source.split('\n');
        const lineText = lines[err.line - 1] ?? '';

        console.error(`Error on line ${err.line}:`);
        console.error(`  ${lineText}`);

        const padding   = ' '.repeat(2 + (err.column - 1));
        const underlines = '^'.repeat(err.length);
        console.error(`${padding}${underlines}`);
        console.error(`  ${err.message}`);
    } else if (err instanceof Error) {
        console.error(`${stage} Error: ${err.message}`);
    } else {
        console.error(`An unknown error occurred during ${stage.toLowerCase()}.`);
    }
}
```

### Output Anatomy

```
Error on line 3:          ← line from CompilerError.line
  output 1920x1080        ← source.split('\n')[line - 1]
         ^^^^^^^^^        ← ' '.repeat(2 + column - 1) + '^'.repeat(length)
  Value must be a valid source  ← CompilerError.message
```

The `2` in the padding calculation accounts for the two-space indent before the source line (`  ` prefix on the `console.error` call).

### Key Design Decision: Decoupled Architecture

The source text is **not** passed into the lexer, parser, or analyzer. Instead, those stages only produce structured `CompilerError` values with coordinate metadata. The CLI then uses those coordinates to extract the relevant line from the source text it already holds.

This keeps the pipeline stages clean and independent — the parser doesn't need to know about file I/O, and the CLI doesn't need to understand parsing rules.

```
Source Text ──────────────────────────────────────────────┐
    │                                                      │ (held by CLI)
    ▼                                                      │
 Lexer → tokens (with line/col/len)                       │
    │                                                      │
    ▼                                                      │
 Parser → AST (with line/col/len)                         │
    │                                                      │
    ▼                                                      │
 Analyzer                                                  │
    │                                                      │
    └── CompilerError(message, line, col, len) ──► CLI ───┘
                                                   │
                                                   ▼
                                            Formatted Output
```

---

## 7. How Location Metadata Flows

Here is the end-to-end journey of a single character offset from the raw source text to the `^^^` underline on the terminal:

```
Source file:  "resize invalid\n"
                      ^
                      offset 7 in the string

Lexer exec():
  match.index = 7  →  column = 7 + 1 = 8
  match[0]    = "invalid"  →  length = 7
  Token: { type: 'IDENTIFIER', value: 'invalid', line: 1, column: 8, length: 7 }

Parser (resize case):
  nextResizeToken = Token above
  Throws: CompilerError("Resolution Value...", line=1, column=8, length=7)

CLI handleError():
  lineText  = "resize invalid"
  padding   = ' '.repeat(2 + 8 - 1) = "         " (9 spaces)
  underlines = '^'.repeat(7)         = "^^^^^^^"

Output:
  Error on line 1:
    resize invalid
           ^^^^^^^
    Resolution Value must be a valid source. Eg 1280x720
```

---

## 8. Error Reference Table

A complete reference of every error message the compiler can produce, which stage emits it, and which token it points to.

### Lexer Errors

| Message | Points to |
|---|---|
| `Unknown token: <value>` | The unrecognised token |

### Parser Errors

| Command | Message | Points to |
|---|---|---|
| `input` | `File source is required` | The bad/missing argument |
| `output` | `File source is required` | The `output` keyword |
| `output` | `Value must be a valid source` | The non-string argument |
| `resize` | `Resize value is required` | The `resize` keyword |
| `resize` | `Resolution Value must be a valid source. Eg 1280x720` | The non-resolution token |
| `fps` | `FPS value is required` | The `fps` keyword |
| `fps` | `FPS value must be a number` | The non-number token |
| `encode` | `Both video and audio codecs are required for encoding` | The `encode` keyword |
| `encode` | `Codec values must be valid keywords` | The bad codec token |
| `bitrate` | `Bitrate value is required` | The `bitrate` keyword |
| `bitrate` | `Bitrate value must be a string with units, e.g. '500k' or '2M'` | The non-bitrate token |
| `audio` | `Audio value is required` | The `audio` keyword |
| `audio` | `Audio value must be a string with the audio file path, e.g. 'audio.mp3'` | The bad argument |
| `watermark` | `Both watermark file and position are required for watermarking` | The `watermark` keyword |
| `watermark` | `Watermark file must be a string and position must be a valid keyword` | The bad argument |
| `thumbnail` | `Thumbnail value is required` | The `thumbnail` keyword |
| `thumbnail` | `Thumbnail value must be a time value, e.g. '5s'` | The non-time token |
| `profile` | `Profile name is required` | The `profile` keyword |
| `profile` | `Expected { after profile name` | The profile name token |
| `profile` | `Expected } at the end of profile` | The opening `{` token |
| `profile` | `Unexpected token "<x>" at line N` | The unexpected inner token |
| `use` | `Profile name is required for use` | The `use` keyword |
| `use` | `Profile "<name>" not found at line N` | The profile name token |
| *(any)* | `Unexpected token "<x>"` | The non-keyword top-level token |
| *(any)* | `Unknown keyword: <kw>` | The unknown keyword token |

### Analyzer Errors

| Check | Message | Points to |
|---|---|---|
| Missing input | `Input file is missing.` | Program root |
| Bad input format | `Unsupported input format: <ext>` | Input filename token |
| Missing output | `Output file is missing.` | Program root |
| Bad output format | `Unsupported output format: <ext>` | Output filename token |
| FPS out of range | `Invalid FPS value: <n>. FPS must be a positive number between 1 and 240.` | FPS value token |
| Resize ≤ 0 | `Invalid resize values: <w>x<h>. Width and height must be greater than 0.` | Resolution token |
| Resize not divisible by 2 | `Invalid resize values: <w>x<h>. Width and height must be divisible by 2 for ffmpeg compatibility.` | Resolution token |
| Bad video codec | `Unsupported video codec: <codec>` | Encode span token |
| Bad audio codec | `Unsupported audio codec: <codec>` | Encode span token |
| Empty watermark path | `Watermark file path cannot be empty.` | Watermark span token |
| Bad watermark position | `Unsupported watermark position: <pos>` | Watermark span token |
