# Why Kurenai Is a Strong Fit for MCP

Kurenai is a DSL compiler for media pipelines: humans (or agents) write readable `.crn` scripts, and Kurenai turns them into FFmpeg commands or WebCodecs plans. That shape maps cleanly onto the Model Context Protocol (MCP).

MCP lets AI clients expose **tools**, **resources**, and **prompts**. Kurenai already has the hard part — a validated intermediate language for video and audio. An MCP server is mostly a thin wrapper around the existing API.

---

## The problem MCP solves here

Coding agents are poor at writing correct FFmpeg by hand:

- Flags and filter graphs are dense and easy to get wrong
- Small mistakes fail late (or silently produce bad output)
- There is no shared vocabulary between “resize and watermark this clip” and a valid command line

Kurenai already sits in the middle:

```text
Natural language intent
        ↓
   .crn DSL (validated)
        ↓
 FFmpeg commands / WebCodecs plan
        ↓
   Optional execution
```

MCP is the channel that lets Cursor, Claude Desktop, and similar clients drive that pipeline with tools instead of guessing shell flags.

---

## Why Kurenai specifically

### 1. A constrained language beats unconstrained shell

Agents do better when the action space is narrow. Kurenai’s DSL is small, intentional, and semantically checked (lexer → parser → analyzer → codegen). An MCP tool that accepts DSL and returns compile errors with line/column gives the model a repair loop. Raw `ffmpeg ...` generation does not.

### 2. The public API is already tool-shaped

Existing surfaces map almost 1:1 to MCP tools:

| Capability | Existing API / CLI | MCP tool (illustrative) |
|---|---|---|
| Compile | `compile()`, `compileTarget()` | `kurenai_compile` |
| Validate | analyzer / `validate` | `kurenai_validate` |
| Explain | `explain()` | `kurenai_explain` |
| Run | CLI `run` / `Kurenai.run()` | `kurenai_run` (opt-in) |

No rewrite of the compiler is required. Keep `@arafat2020/kurenai` as the base; expose MCP as a package or export that imports the same functions.

### 3. Real side effects, with a clear boundary

Many MCP demos only read docs or list files. Media work is tangible: resize, normalize loudness, watermark, export. MCP can default to **compile-only** (safe) and gate **execute** behind explicit consent, path allowlists, and dry-run — so usefulness and safety stay aligned.

### 4. Diagnostics feed the agent loop

`CompilerError` already carries message, line, column, and length. That is exactly what an agent needs to fix a bad script in the next turn. Structured failures are a better MCP product than opaque stderr from a handwritten FFmpeg string.

### 5. Dual targets match dual agent environments

- **ffmpeg** — server / local CLI workflows (most agent terminals)
- **webcodecs** — browser / client-side plans

One DSL, two backends. An MCP server can expose `target` as a tool argument without teaching the model two unrelated APIs.

---

## Concrete user stories

These are the use cases that feel “real” rather than demo-only:

1. **Edit from chat** — “Take `talk.mp4`, 1280×720, −14 LUFS, watermark bottom-right, write `talk_out.mp4`.” The agent scaffolds `.crn`, validates, compiles, optionally runs.
2. **Fix a broken pipeline** — User pastes a failing script; `validate` / `compile` return precise errors; the agent patches and rechecks.
3. **Explain before run** — `explain` summarizes what will happen so the user can approve before `run`.
4. **Batch / podcast mastering** — Audio-only DSL (normalize, EQ, fade) driven by an agent over many files via repeated tool calls.
5. **Teach FFmpeg safely** — Agent shows the generated command after a successful compile so humans learn flags without authoring them first.

---

## What MCP should *not* expose

Keep the tool surface outcome-oriented:

- Prefer `compile` / `validate` / `explain` / `run` over leaking every internal stage
- Do not expose arbitrary shell; only run commands Kurenai generated (or equivalent controlled execution)
- Treat file paths carefully — workspace-relative or allowlisted directories only for `run`

Resources (optional later) are a better fit for DSL grammar snippets and presets than for dumping the whole compiler AST into the context window.

---

## Implemented shape

```text
@arafat2020/kurenai          ← DSL + compiler + CLI
src/mcp/server.ts            ← stdio MCP server (bin: kurenai-mcp)
src/mcp/tools.ts             ← tool handlers over the public API
```

**Tools**

| Tool | Behavior |
|---|---|
| `kurenai_compile` | DSL → FFmpeg commands or WebCodecs plan |
| `kurenai_validate` | Syntax + semantic check with line/column errors |
| `kurenai_explain` | Human summary + generated commands |
| `kurenai_scaffold` | Known-good starter scripts for common intents |
| `kurenai_run` | Dry-run by default; `execute=true` runs FFmpeg under cwd |

**Resource:** `kurenai://docs/dsl` — agent-oriented DSL quick reference.

### Cursor / Claude Desktop config (stdio)

```json
{
  "mcpServers": {
    "kurenai": {
      "command": "npx",
      "args": ["-y", "--package=@arafat2020/kurenai", "kurenai-mcp"]
    }
  }
}
```

Or after a local build:

```json
{
  "mcpServers": {
    "kurenai": {
      "command": "node",
      "args": ["/absolute/path/to/kurenai/dist/mcp/server.js"]
    }
  }
}
```

Local dev (TypeScript via tsx, no build needed): `npm run mcp`  
Built bin: `npm run build && npx kurenai-mcp`

### Why “Cannot find module … tools.js” happens

Source files import with **`.js` extensions** (`from "./tools.js"`). That is required by TypeScript `moduleResolution: "nodenext"`, and `tsx` / `tsc` remaps those to `.ts` / emitted `.js`.

Plain Node does **not**:

```bash
# fails — looks for tools.js next to server.ts
node --experimental-strip-types src/mcp/server.ts

# works — tsx resolves .js → .ts
npm run mcp

# works — after build, runs compiled output
npm run build && npx kurenai-mcp
```

Also run `npm install` after pulling so `@modelcontextprotocol/sdk` and `zod` exist.

See also `docs/ffmpeg-gaps.md` for which FFmpeg capabilities the DSL covers today.

---

## Bottom line

MCP needs domains where agents fail without structure and succeed with tools. Media encoding is one of those domains. Kurenai already provides the structure — a human-readable, validated DSL with a stable TypeScript API. Wrapping that API as an MCP server turns “write FFmpeg correctly” into “describe the pipeline and let tools compile it,” without changing the compiler core.

That is a practical agent use case: natural language in, validated media pipeline out.
