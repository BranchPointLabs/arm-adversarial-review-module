# ARM - Adversarial Review Module

ARM is a review tool for technical product work. It helps a user keep one active project document sharp by surrounding it with chat, review cards, notes, decisions, and references.

The core product idea is simple:

```text
document -> ask ARM -> receive small cards -> resolve as note or decision -> update the document
```

ARM is not meant to replace product or engineering judgment. It is meant to make judgment easier to apply by turning messy thinking into smaller reviewable units.

## Project Status

This repository currently contains:

- a Tauri desktop application in `arm/`
- a static GitHub Pages site at the repository root
- project documentation in `arm/docs/`

The application is under active development. The current build supports local projects, typed documents, references, notes, decisions, LLM-backed review, heuristic fallback review, and desktop-only local persistence.

For a product-facing overview of what the app supports, see [features.md](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/features.md).

## What ARM Does

ARM is built around a selected document. That document is the source of truth for the current project query.

Supported document types:

- `IDEA`
- `PRD`

Around that document, ARM supports:

- chat prompts
- product review
- technical review
- combined product and technical review
- review cards
- accepted notes
- accepted decisions
- attached references
- local persistence

Current card types:

- `info`
- `open_question`
- `warning`
- `action`

Current card statuses:

- `pending`
- `accepted`
- `rejected`
- `edited`
- `resolved`

## Repository Layout

```text
.
|-- index.html              Static GitHub Pages site
|-- site.css                Static site styles
|-- README.md               Repository overview
|-- docs/                   Older public docs and planning notes
`-- arm/
    |-- src/                 React + TypeScript frontend
    |-- src-tauri/           Rust + Tauri desktop backend
    |-- docs/                Current application documentation
    |-- package.json         Frontend and Tauri commands
    `-- README.md            App-specific technical notes
```

## Tech Stack

Application:

- Tauri 2
- React
- TypeScript
- Rust
- SQLite
- local markdown-style project documents
- OpenAI / Anthropic API keys supplied by the user

Static website:

- plain HTML
- plain CSS
- no build step
- GitHub Pages friendly

## Key Concepts

### Project

A project is a local workspace that contains documents, references, decisions, notes, and review cards.

### Document

A document is the current source of truth. The selected document is what ARM uses as context for chat and review.

### Reference

A reference is an attached local text file or folder item that can support the current review.

### Card

A card is a small review output. ARM intentionally avoids long essay responses in review mode.

### Decision

A decision is durable project truth. When a card or update is resolved as a decision, ARM logs it and can use it to patch the active document.

### Note

A note is useful context that may inform the document but is less formal than a decision.

## Launching the App

There are three different surfaces in this repository. They are easy to confuse, so the distinction matters.

### 1. Static Website

The root `index.html` and `site.css` files are the public static site.

Open `index.html` directly in a browser, or serve the repository root with any static server.

This is not the app. It is the project website.

### 2. Desktop Application

The desktop app is the real application.

From the repository root:

```powershell
cd arm
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
npm run tauri dev
```

Desktop behavior:

- opens a native Tauri window
- uses the Rust backend
- stores durable data locally
- uses SQLite for project data
- supports local file operations through Tauri

If you open the frontend directly in a browser, ARM now shows a desktop-required screen instead of running a fallback mode.

## First-Time Setup

Install Node.js and Rust first.

Check Node:

```powershell
node --version
npm --version
```

Check Rust:

```powershell
rustc --version
cargo --version
```

If Rust is not installed on Windows, install it with Rustup:

```powershell
winget install Rustlang.Rustup
```

Restart the terminal after installing Rust.

Install app dependencies:

```powershell
cd arm
npm install
```

## Common Commands

Build the frontend:

```powershell
cd arm
npm run build
```

Run the desktop app:

```powershell
cd arm
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
npm run tauri dev
```

Run Rust tests:

```powershell
cd arm\src-tauri
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
cargo test
```

Build the desktop app:

```powershell
cd arm
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
npm run tauri build
```

## LLM Configuration

Open the app and use:

```text
File -> LLM Settings
```

Supported providers:

- OpenAI
- Anthropic

The user supplies their own API key. Keys are stored locally and are not committed to the repository.

Current review routing:

- `Chat` uses a general helpful ARM persona and returns an `info` card
- `Product` uses the product persona in `arm/src/core/ceo.md`
- `Technical` uses the engineering persona in `arm/src/core/eng.md`
- `Everything` runs product and technical review

If an LLM key is missing or a provider call fails, ARM can fall back to the local heuristic review engine.

## Local Data and Persistence

The desktop app stores project data locally through the Rust backend. Project data includes:

- projects
- documents
- chat notes
- decisions
- references
- agent runs
- agent cards

SQLite is used for durable project state in the desktop app.

Important: local data and API keys should not be committed to Git. The repository `.gitignore` is intended to keep local build output, caches, databases, keys, and generated artifacts out of source control.

## Main Application Files

Frontend:

- `arm/src/ui/App.tsx`
- `arm/src/ui/project/ProjectWorkspace.tsx`
- `arm/src/ui/styles.css`
- `arm/src/core/projectStore.ts`
- `arm/src/core/tauriProjectStore.ts`
- `arm/src/core/llmReview.ts`
- `arm/src/core/armEngine.ts`
- `arm/src/core/ceo.md`
- `arm/src/core/eng.md`

Backend:

- `arm/src-tauri/src/main.rs`

Static site:

- `index.html`
- `site.css`

## Documentation

The most useful documentation lives in `arm/docs/`.

Recommended reading order:

1. `arm/docs/application-overview.md`
2. `arm/docs/architecture.md`
3. `arm/docs/workflows.md`
4. `arm/docs/state-and-data-flow.md`
5. `arm/docs/prompts-personas-and-review-cards.md`
6. `arm/docs/operations.md`
7. `arm/docs/testing-and-smoke-checks.md`
8. `arm/docs/known-issues-warnings-and-mocks.md`
9. `arm/docs/next-development-plan.md`

## Working on the Codebase

If you are new to Rust or Tauri, start with this mental model:

- React renders the interface.
- TypeScript owns most UI state and user interaction.
- Tauri lets React call native desktop commands.
- Rust handles local project persistence and SQLite.
- SQLite stores durable project state.

The main workflow lives in:

```text
arm/src/ui/project/ProjectWorkspace.tsx
```

The provider-backed review path lives in:

```text
arm/src/core/llmReview.ts
```

The Rust command layer lives in:

```text
arm/src-tauri/src/main.rs
```

## Current Known Boundaries

The app is usable, but still evolving.

Known architectural areas to keep improving:

- `ProjectWorkspace.tsx` is large and should eventually be split into smaller components.
- `src-tauri/src/main.rs` is monolithic and should eventually be split by domain.
- Reference ingestion is currently text-first.
- The card and context update workflow is still being refined through UX iteration.

## Public Website

The static website is intentionally simple. It explains what ARM is and includes a comparison table for BMAD vs. ARM.

Files:

```text
index.html
site.css
```

No framework or build step is required for the static site.

## License

No license has been declared yet. Add one before distributing or accepting outside contributions.
