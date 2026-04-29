# Install

## Local

Run from repo root:

```bash
node ./bin/arm.js help
```

## npm link

When npm is available:

```bash
npm link
arm status
```

## Package Shape

ARM exposes:

```json
{
  "bin": {
    "arm": "./bin/arm.js"
  }
}
```

## Current Note

This machine's npm install is missing its global CLI module.

Use direct Node commands until npm is repaired:

```bash
node ./scripts/smoke-test.js
```

For the desktop shell with pnpm:

```bash
corepack pnpm install
node ./node_modules/electron/install.js
corepack pnpm run desktop
```
