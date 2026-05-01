# State and Data Flow

## Core entities

The current frontend entity model is defined in [types.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/types.ts).

Main entities:

- `Project`
- `ProjectDocument`
- `ChatNote`
- `Decision`
- `ProjectReference`
- `AgentCard`

## Data ownership

### Frontend runtime state

`ProjectWorkspace.tsx` holds most live workspace state in React:

- documents
- notes
- decisions
- references
- cards
- active document
- current document markdown
- modal state
- sidebar state
- submit/loading/error state

This is a pragmatic implementation, but it creates a large local state surface.

### Persistence boundary

The frontend does not call Rust directly from the workspace. It goes through `projectStore`.

That interface provides:

- project CRUD
- document CRUD
- note CRUD
- decision CRUD
- reference CRUD
- card CRUD
- legacy current-context load/save

## Browser-mode flow

`browserProjectStore.ts` persists a single JSON structure in `localStorage`.

Important details:

- all projects live under one storage key
- project creation initializes empty documents, notes, decisions, references, and cards
- saving a document also updates the in-memory/browser `context` mirror

This means browser preview behavior is close to desktop behavior, but not identical.

## Desktop-mode flow

`tauriProjectStore.ts` maps each store call to a Tauri command.

Those commands are implemented in [main.rs](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src-tauri/src/main.rs).

Desktop persistence uses:

- a per-project SQLite database
- filesystem mirrors under the project folder

## Current context versus selected document

This is the most important state-model nuance in the app today.

The product direction is moving toward:

- selected document = active context source of truth

But the backend still keeps:

- `current_context` SQLite table
- `context/CURRENT_CONTEXT.md` file

In both browser and desktop implementations, document create/save currently also updates the context mirror.

That means:

1. the user-facing model is document-centric
2. the persistence model is still partially context-mirror-centric

This should be treated as an intentional compatibility layer until it is removed or made explicit.

## Review generation flow

When a user submits a review prompt:

1. the workspace checks that an active document exists
2. it builds a review input payload using:
   - prompt
   - selected document
   - current markdown
   - recent notes
   - decisions
   - selected references
3. it tries provider-backed review if configured
4. if that fails, it falls back to `armEngine.ts`
5. resulting cards are persisted
6. accepted or edited cards later feed `buildContextDraft`

## Reference data flow

References are loaded into the app through browser-side file handling:

1. file is picked or dropped
2. browser reads text content
3. text is trimmed for storage
4. app computes a small summary
5. reference is persisted in the store

This means reference ingestion currently happens on the frontend, not in Rust.

## LLM settings data flow

Provider/model settings:

- stored in `localStorage`

API keys:

- encrypted with Web Crypto
- encrypted payload stored in `localStorage`
- encryption key stored in IndexedDB

This is local-only protection, not a full secret-management system. It is appropriate for a local desktop tool, but should be documented honestly.
