# Operations

## What you need installed

For local development:

- Node.js
- npm
- Rust
- Cargo

## Launching the browser preview

From:

`C:\Users\clbra\OneDrive\Desktop\arm-adversarial-review-module\arm`

Run:

```powershell
npm run dev -- --host 127.0.0.1 --port 5173
```

Use this for:

- frontend styling
- layout iteration
- basic UI smoke checks

Do not use this mode to validate true desktop persistence behavior.

## Launching the desktop app

From:

`C:\Users\clbra\OneDrive\Desktop\arm-adversarial-review-module\arm`

Run:

```powershell
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
npm run tauri dev
```

This launches the real Tauri desktop app.

## Building the frontend

```powershell
cd C:\Users\clbra\OneDrive\Desktop\arm-adversarial-review-module\arm
npm run build
```

## Running Rust tests

```powershell
cd C:\Users\clbra\OneDrive\Desktop\arm-adversarial-review-module\arm\src-tauri
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
cargo test
```

## Where desktop projects are stored

The backend resolves the project base directory like this:

1. `Documents\ARM`
2. if that fails, app data directory for `ARM`

Each project becomes its own folder with `arm.db` and support folders.

## How API keys are handled

LLM settings are managed through:

- `File -> LLM Settings`

Current behavior:

- provider choice is saved locally
- model choice is saved locally
- API keys are encrypted before storage
- encrypted payload lives in `localStorage`
- the local encryption key lives in IndexedDB

This is appropriate for a local tool, but it is not equivalent to OS-level credential vault integration.

## If you are new to Rust

You can be productive here without being a Rust expert.

Start with this mental model:

1. React renders the app and manages interaction
2. `projectStore` decides whether the runtime is browser or desktop
3. Tauri commands bridge the UI to local persistence
4. Rust stores the durable state in SQLite and filesystem mirrors

When debugging:

- if the UI looks wrong, start in `src/ui/`
- if data does not persist in desktop mode, inspect `src-tauri/src/main.rs`
- if browser preview works but desktop does not, inspect `tauriProjectStore.ts` and Tauri command names
