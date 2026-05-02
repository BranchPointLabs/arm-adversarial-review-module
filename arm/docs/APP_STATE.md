# ARM Application State

## Summary

ARM is currently a project review workspace with:

- project creation and selection
- one editable `CURRENT_CONTEXT.md` per project
- typed supporting documents (`IDEA`, `PRD`)
- chat notes
- explicit decisions
- reference attachment from files and folders
- concise review cards
- provider-backed product and engineering reviews
- manual context rewrite flow

## Workflow now

1. Open a project
2. Add notes with the bottom input in `chat` mode
3. Add decisions with `Add Decision`
4. Attach references in `References`
5. Run review prompts in `product review`, `technical review`, or `everything`
6. Accept, reject, or edit cards in the right rail
7. Use `Update Context` to generate a replacement context draft
8. Apply the draft to rewrite `CURRENT_CONTEXT.md`

## Persistence model

Desktop mode:

- project folders on disk
- `arm.db` SQLite database
- `CURRENT_CONTEXT.md` on disk

Browser preview mode:

- `localStorage`
- no native filesystem integration

## Important implementation note

The app supports both browser preview and Tauri desktop mode through the same `projectStore` interface.

- `browserProjectStore.ts`
  preview mode
- `tauriProjectStore.ts`
  desktop mode

This keeps the UI mostly independent from the storage backend.

## Review system state

Review cards now have two paths:

- primary path
  provider-backed generation through `src/core/llmReview.ts`
- fallback path
  local heuristic generation through `src/core/armEngine.ts`

Persona mapping:

- `product review`
  `src/core/cpo.md`
- `technical review`
  `src/core/eng.md`
- `everything`
  both personas, merged

## Main technical risks

- `src-tauri/src/main.rs` is still a large single backend file
- reference parsing is intentionally shallow and text-first
- live review quality now depends on prompt quality, selected model, and provider availability
- project documents and current context are related but still distinct concepts in the app model

## Best next refactor

Split `src-tauri/src/main.rs` into modules:

- `projects`
- `documents`
- `references`
- `cards`
- `context`
- `schema`
