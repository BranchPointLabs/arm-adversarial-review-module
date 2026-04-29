# Testing

## Smoke Test

```bash
node ./scripts/smoke-test.js
node ./scripts/desktop-smoke-test.js
```

Checks:

```text
1. Config parsing.
2. Persona loading.
3. Checklist loading.
4. Prompt assembly.
5. Heuristic review rendering.
6. Decision rendering.
7. Option parsing.
8. Slate output repair.
```

## Manual Checks

```bash
node ./bin/arm.js validate
node ./bin/arm.js status
node ./bin/arm.js review idea examples/idea.md --no-write
node ./bin/arm.js review roast examples/idea.md --prompt
Get-Content examples/idea.md | node ./bin/arm.js review idea --stdin --no-write
```

## Backend Checks

Heuristic:

```bash
node ./bin/arm.js review idea examples/idea.md --backend heuristic --no-write
```

OpenAI:

```bash
$env:OPENAI_API_KEY="..."
node ./bin/arm.js review idea examples/idea.md --backend openai --no-write
```
