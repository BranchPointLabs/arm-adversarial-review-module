# Folder and File Map

## Top-level

`arm/`

- `package.json`
  frontend scripts and dependencies
- `README.md`
  user-facing project introduction
- `docs/`
  internal documentation set
- `src/`
  React + TypeScript app
- `src-tauri/`
  Tauri + Rust desktop backend

## Frontend folders

### `src/core/`

- [types.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/types.ts)
  shared frontend types and the `ProjectStore` interface
- [projectStore.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/projectStore.ts)
  desktop store binding
- [tauriProjectStore.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/tauriProjectStore.ts)
  Tauri IPC bridge
- [armEngine.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/armEngine.ts)
  heuristic review and context drafting
- [llmReview.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/llmReview.ts)
  provider-backed review generation
- [llmSettings.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/llmSettings.ts)
  provider/model settings and local key storage
- [reviewPersonas.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/reviewPersonas.ts)
  persona selection
- [cpo.md](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/cpo.md)
  product-review persona prompt
- [eng.md](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/eng.md)
  engineering-review persona prompt
- [contextTemplate.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/contextTemplate.ts)
  default markdown templates for new documents

### `src/ui/`

- [App.tsx](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/ui/App.tsx)
  global shell and app-bar menus
- [styles.css](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/ui/styles.css)
  app styling

### `src/ui/project/`

- [ProjectWorkspace.tsx](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/ui/project/ProjectWorkspace.tsx)
  main workspace screen

### `src/ui/screens/`

- [ProjectHome.tsx](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/ui/screens/ProjectHome.tsx)
  home screen
- [CurrentContext.tsx](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/ui/screens/CurrentContext.tsx)
- [Inputs.tsx](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/ui/screens/Inputs.tsx)
- [ReferencesScreen.tsx](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/ui/screens/ReferencesScreen.tsx)
- [ReviewFeedScreen.tsx](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/ui/screens/ReviewFeedScreen.tsx)

The non-home files in this folder look like older or alternate screen implementations. They do not appear to be the current main workspace path.

### `src/ui/shared/`

- shared UI components such as `Menu` and `Modal`

## Backend folders

### `src-tauri/src/`

- [main.rs](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src-tauri/src/main.rs)
  all current backend logic

### `src-tauri/`

- `Cargo.toml`
  Rust crate manifest
- `tauri.conf.json`
  desktop app configuration

## Desktop data folders created at runtime

Each desktop project creates:

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

## Docs folder

This docs folder is intended to become the primary orientation layer for the app.
