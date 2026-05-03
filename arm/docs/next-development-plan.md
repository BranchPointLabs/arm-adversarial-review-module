# Next Development Plan

## Goal of the next phase

Stabilize the app around one clear source-of-truth model and reduce structural complexity before adding larger new features.

## Recommended order

### 1. Finish the context-model decision

Choose one of these explicitly:

1. selected document is the only source of truth
2. `CURRENT_CONTEXT.md` remains the canonical source and documents are secondary

Right now the app acts like option 1 in the UI and option 1.5 in persistence.

### 2. Decompose the workspace

Split `ProjectWorkspace.tsx` into smaller pieces:

- left navigation
- center document pane
- sidebar stream
- composer
- references view
- card actions
- context draft modal

### 3. Decompose the Rust backend

Split `main.rs` into modules:

- `schema`
- `projects`
- `documents`
- `notes`
- `decisions`
- `references`
- `cards`
- `context`

### 4. Clean out stale screens and naming

Remove or archive old screens that are no longer used, and make naming consistent around:

- context
- document
- current context
- workspace

### 5. Add better test coverage

Highest-value additions:

- project-store integration tests
- mocked LLM review tests
- desktop end-to-end smoke checks

### 6. Improve secrets handling if desired

If stronger local protection is needed later, move from IndexedDB-backed encryption toward native OS credential storage.

### 7. Expand reference ingestion deliberately

Only after the context model is stable:

- PDF extraction
- richer file-type support
- better summary quality
- selection and section-level reference targeting

## Things not to do next

- do not add more large features into `ProjectWorkspace.tsx` first
- do not deepen the mirror model before deciding whether it should exist
- do not treat a plain browser tab as sufficient validation for desktop correctness
