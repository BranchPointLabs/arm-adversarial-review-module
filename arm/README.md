# ARM

ARM is the `Adversarial Review Module`: a desktop app for shaping project thinking into a living context document.

## What the app does

ARM keeps one `CURRENT_CONTEXT.md` per project and lets you build around it with:

- chat notes for messy thinking
- explicit decisions for project truth
- attached references from files or folders
- short review cards instead of long AI essays
- live provider-backed reviews when keys are configured
- an `Update Context` flow that rewrites the context document from accepted signal

The intended loop is:

`input -> review cards -> accept/reject/edit -> update current context`

## Current app state

The current build supports:

- creating and selecting projects
- storing data locally in SQLite for the desktop app
- editing `CURRENT_CONTEXT.md`
- creating typed documents (`IDEA` and `PRD`)
- capturing chat notes
- capturing decisions
- attaching files or folders as references
- selecting, summarizing, and removing references
- generating review cards with either a live provider or a local heuristic fallback
- accepting, rejecting, and editing cards
- generating a replacement context draft from decisions, accepted cards, and selected references

## What runs where

This project has two halves:

- `src/`
  React + TypeScript UI
- `src-tauri/`
  Rust + Tauri backend

### React side

The React app handles:

- layout and navigation
- text editing
- file drag/drop and file reading
- local review heuristics
- modals and menus

Important files:

- `src/ui/App.tsx`
  top bar, menus, global modals
- `src/ui/project/ProjectWorkspace.tsx`
  main project workflow
- `src/core/armEngine.ts`
  review-card generation, reference summaries, context draft generation
- `src/core/llmReview.ts`
  OpenAI and Anthropic review requests
- `src/core/reviewPersonas.ts`
  loads the CPO and engineering personas from markdown
- `src/core/cpo.md`
  product review persona
- `src/core/eng.md`
  engineering review persona
- `src/core/tauriProjectStore.ts`
  desktop IPC bridge to Rust

### Rust side

The Rust app handles:

- project folder creation
- SQLite schema and persistence
- reading/writing `CURRENT_CONTEXT.md`
- storing notes, decisions, references, documents, and cards

Important file:

- `src-tauri/src/main.rs`
  Tauri commands and SQLite logic

## Local data layout

Each desktop project is stored locally under an `ARM` folder in your Documents directory, or AppData if Documents is not writable.

Each project folder contains:

```text
project-name/
  context/
    CURRENT_CONTEXT.md
    decisions.md
    idea_log.md
  references/
  runs/
  arm.db
```

SQLite tables currently include:

- `projects`
- `documents`
- `chat_notes`
- `decisions`
- `project_references`
- `agent_runs`
- `agent_cards`
- `current_context`

## Desktop app

```powershell
cd arm
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
npm run tauri dev
```

This is the real app.

In desktop mode:

- React still renders the UI
- Rust handles persistence and local files
- SQLite stores durable state
- the browser view is intentionally disabled

## First-time setup

### Prerequisites

You need:

- Node.js
- npm
- Rust
- Cargo on your `PATH`

### Check Rust

```powershell
rustc --version
cargo --version
```

If those fail, install Rust with `rustup`.

## Common commands

From `arm/`:

```powershell
npm run build
```

Builds the React frontend.

```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
cd src-tauri
cargo test
```

Runs the Rust tests.

```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
npm run tauri dev
```

Launches the desktop app.

## How to use the app

1. Create a project from `Projects -> New Project...`
2. Create a document and select it as the active context
3. Use the bottom bar in `chat`, `product`, `technical`, or `everything`
4. Add explicit decisions and references as needed
5. Accept or dismiss cards in the right rail
6. Resolve accepted cards into patches, decisions, or open questions

## LLM settings

`File -> LLM Settings` stores provider, model choice, and encrypted API keys on the local machine.

Provider-backed reviews work like this:

- `product review`
  uses the CPO persona
- `technical review`
  uses the engineering persona
- `everything`
  runs both personas and merges their cards

If there is no saved key, or the provider call fails, ARM falls back to the local review engine so the workflow still completes.

## Known boundaries

Current implementation choices:

- review generation prefers the configured provider and falls back to the local heuristic reviewer
- reference ingestion is text-first
- folder attach lists files and reads supported text files
- `Update Context` is user-confirmed and replaces the context document

Still good future candidates:

- richer reference parsing for PDFs and docs
- more robust context section targeting
- card filtering and run history

## If you are new to Rust

You do not need to understand advanced Rust to work on this project.

The most useful mental model is:

- React builds the interface
- Tauri connects the interface to native desktop capabilities
- Rust exposes small commands
- SQLite stores durable state

When the frontend wants data, it calls a Tauri command through `invoke(...)`.
Those commands live in `src-tauri/src/main.rs`.

Start by reading:

1. `src/ui/project/ProjectWorkspace.tsx`
2. `src/core/projectStore.ts`
3. `src/core/tauriProjectStore.ts`
4. `src-tauri/src/main.rs`
