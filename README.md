# ARM (Clean Start)

ARM is a local-first review tool for technical PMs.

Core loop:

input -> agent card review -> accept/reject/edit -> update living project document

This repo is a clean-start rebuild using:

- Tauri
- React
- TypeScript
- SQLite (per-project)
- Local markdown files
- OpenAI API via user-supplied key (later phase)

## Dev Prereqs

1. Node.js (already installed)
2. Rust toolchain (required for Tauri)

Rust install (Windows):

```powershell
winget install Rustlang.Rustup
```

Then restart your terminal.

## Run

```powershell
cd arm
npm install
npm run tauri dev
```

## Project Layout

Repo:

```text
arm/
  src/
  src-tauri/
docs/
README.md
```

Each user project (created under Documents/ARM):

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
