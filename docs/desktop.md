# Desktop

ARM has an Electron shell.

## Run

```bash
npm install
npm run electron
```

If npm is unavailable:

```bash
corepack pnpm install
node ./node_modules/electron/install.js
corepack pnpm run desktop
```

Static check:

```bash
node ./scripts/desktop-smoke-test.js
```

## UX

```text
1. Open file or paste text.
2. Choose review type.
3. Choose backend.
4. Add API key for OpenAI.
5. Review, Roast, or Decide.
6. Copy or save Markdown.
```

## Security

The API key is only passed to the main process for the current request.

ARM does not persist keys yet.

## Package Files

```text
electron/main.js
electron/preload.js
electron/renderer/index.html
electron/renderer/renderer.js
electron/renderer/styles.css
```
