# Architecture

## High-level structure

ARM is split into two main layers:

1. React + TypeScript frontend in `src/`
2. Tauri + Rust backend in `src-tauri/`

The runtime is desktop-only and uses a Tauri-backed project store.

## Main frontend pieces

### App shell

[App.tsx](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/ui/App.tsx)

Responsibilities:

- top-level app bar
- project create/select modals
- LLM settings modal
- route setup
- navigation into project workspaces

### Project workspace

[ProjectWorkspace.tsx](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/ui/project/ProjectWorkspace.tsx)

This is the heaviest React component in the app today.

Responsibilities:

- loading project state
- selecting the active document
- rendering the left navigation rail
- rendering the center content pane
- rendering the unified activity sidebar
- capturing prompt input
- running reviews
- adding notes and decisions
- attaching and managing references
- card acceptance, rejection, and editing
- generating and applying the context rewrite draft
- displaying errors and modals

Architecturally, this file is carrying too much responsibility and is the main frontend candidate for decomposition.

### Project storage boundary

[projectStore.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/projectStore.ts)

This is the main runtime abstraction. The UI talks to `projectStore`, and `projectStore` chooses the concrete implementation:

- [tauriProjectStore.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/tauriProjectStore.ts)

### Local review and context drafting

[armEngine.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/armEngine.ts)

Responsibilities:

- local heuristic review-card generation
- reference summarization
- context rewrite draft generation

This is the non-provider fallback path.

### LLM review path

[llmReview.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/llmReview.ts)

Responsibilities:

- load LLM settings
- fetch encrypted API key
- choose provider
- construct review instruction + payload
- call OpenAI or Anthropic
- parse structured card JSON
- normalize the resulting cards

### Persona source

[reviewPersonas.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/reviewPersonas.ts)

Persona content lives in:

- [cpo.md](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/cpo.md)
- [eng.md](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/eng.md)

### LLM settings and key handling

[llmSettings.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/llmSettings.ts)

Responsibilities:

- provider/model settings in `localStorage`
- encrypted API-key storage
- Web Crypto encryption/decryption
- IndexedDB storage for the local encryption key

## Backend structure

### Tauri command layer

[main.rs](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src-tauri/src/main.rs)

The Rust backend is currently monolithic. One file owns:

- app setup
- base directory resolution
- schema initialization
- project creation
- document CRUD
- note CRUD
- decision CRUD
- reference CRUD
- card CRUD
- current-context mirror synchronization
- small helpers and tests

This works, but it is the largest structural weakness on the backend side.

## Storage architecture

### Desktop mode

- each project gets a local folder
- project state is stored in `arm.db`
- document mirrors are also written to `context/CURRENT_CONTEXT.md`

## Architectural strengths

- clean runtime boundary through `projectStore`
- real desktop persistence
- typed document model is already present
- LLM path and heuristic fallback are separate concerns
- provider persona prompts are isolated from the transport logic

## Architectural weaknesses

- `ProjectWorkspace.tsx` is overloaded
- `main.rs` is overloaded
- legacy `current_context` mirror still exists beside the new document-centric model
- some older screens still exist in `src/ui/screens/` but are no longer the main workspace path

## Suggested refactor targets

1. split `ProjectWorkspace.tsx` into layout, sidebar, document editor, references pane, and review actions
2. split `main.rs` into modules: `projects`, `documents`, `notes`, `decisions`, `references`, `cards`, `schema`
3. decide whether `CURRENT_CONTEXT.md` is still a true source of truth or only a mirror
4. make routing and naming consistent around `context` versus `document`
