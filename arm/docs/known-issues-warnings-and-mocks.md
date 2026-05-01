# Known Issues, Warnings, and Mocks

## Top warnings

### 1. Context model is still split

The UI is moving toward:

- selected document = context source of truth

But persistence still maintains:

- `CURRENT_CONTEXT.md`
- `current_context` SQLite table

That means the app currently has a compatibility mirror rather than one fully unified context model.

### 2. `ProjectWorkspace.tsx` is too large

The main workspace component owns too much behavior and too much state. That raises the cost of changes and makes UI regressions easier to introduce.

### 3. `main.rs` is too large

The Rust backend is still a single-file service layer. It works, but it is harder to reason about than a small module tree would be.

### 4. There are likely stale screens and stale wording

Files like:

- `CurrentContext.tsx`
- `Inputs.tsx`
- `ReferencesScreen.tsx`
- `ReviewFeedScreen.tsx`

still exist, but the main app path uses `ProjectWorkspace.tsx`.

Some documentation outside this docs set also still refers to:

- one fixed `CURRENT_CONTEXT.md`
- a bottom input bar

Those details are no longer fully accurate.

### 5. Browser preview and desktop mode are materially different

Bugs can hide because:

- browser preview uses `localStorage`
- desktop uses SQLite and filesystem mirrors

Both must be tested.

## Current mocks and fallback behavior

### Heuristic review fallback

If the provider path fails, the app can still generate cards locally through `armEngine.ts`.

This is not a fake UI mock. It is a real fallback behavior.

### Browser project store

Browser preview is effectively a mocked local persistence environment built on `localStorage`.

That is useful, but it should not be mistaken for the real desktop persistence layer.

## Text-handling limitations

- references are text-first
- unsupported binary formats are not deeply parsed
- file text is truncated on ingestion
- generated summaries are simple

## Security and secret-handling caveat

API keys are locally encrypted from casual view, but this is not equivalent to using the operating system's credential vault. Anyone changing secret-handling should treat this as a practical local convenience layer, not as enterprise secret storage.

## Documentation warning

The repo-level [README.md](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/README.md) is partly stale relative to the current app behavior and should be refreshed in a follow-up pass.
