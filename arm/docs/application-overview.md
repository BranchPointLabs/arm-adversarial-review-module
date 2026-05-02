# Application Overview

## What ARM is

ARM is a review tool for technical product work.

Its core job is to help a user:

1. create a project
2. create one or more typed documents
3. treat the selected document as the working context
4. capture notes, decisions, and references around that context
5. run adversarial review
6. accept, reject, or edit review cards
7. rewrite the working context with stronger signal

The app is desktop-first, but it also supports a browser preview mode for UI work.

## Current product model in the code

The code currently behaves like this:

- a project can exist with zero documents
- documents have a required type: `IDEA` or `PRD`
- the selected document in the center pane is treated as the active context for review
- notes, decisions, references, and cards orbit around the active project
- `Update Context` rewrites the selected document with a generated draft

There is still a legacy `CURRENT_CONTEXT.md` mirror and `current_context` table in the backend for compatibility. That means the implementation is between two models:

1. old model: one fixed context file per project
2. newer model: selected document is the context source of truth

That split is important and should stay visible to anyone working on the app.

## What a user sees

### Home screen

- recent projects on the left
- a guide panel on the right
- top app bar with `File` and `Projects`

### Project workspace

- left rail: project navigation and document list
- center pane: selected document or focused project view
- right rail: unified activity sidebar
- modal-driven actions for project creation, document creation, LLM settings, decisions, card editing, and context replacement

### Sidebar modes

The right rail supports:

- `Activity`
- `Cards`
- `Notes`
- `Decisions`

The composer in that rail supports:

- `Chat`
- `Note`
- `Decision`
- `Review`

Review mode then branches into:

- `product review`
- `technical review`
- `everything`

## Current runtime modes

### Desktop mode

Desktop mode is the real application:

- Tauri shell
- Rust backend
- SQLite persistence
- local project folders

### Browser preview mode

Browser preview is a convenience mode:

- normal React app in the browser
- `localStorage` persistence
- no Rust runtime
- no real local project folders

This is useful for frontend iteration, but it is not a full simulation of desktop behavior.

## Who should read this first

If you are onboarding:

1. read [architecture.md](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/docs/architecture.md)
2. read [workflows.md](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/docs/workflows.md)
3. open [ProjectWorkspace.tsx](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/ui/project/ProjectWorkspace.tsx)
4. open [projectStore.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/projectStore.ts)
5. open [main.rs](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src-tauri/src/main.rs)
