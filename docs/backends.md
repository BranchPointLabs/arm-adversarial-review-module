# Backends

## Heuristic

Default backend.

```bash
node ./bin/arm.js review idea examples/idea.md --backend heuristic
```

Use it for:

```text
1. Offline checks.
2. CLI smoke tests.
3. Fast structure validation.
```

It is not a full model review.

## OpenAI

Optional backend.

```bash
$env:OPENAI_API_KEY="..."
node ./bin/arm.js review roast examples/idea.md --backend openai --model gpt-4.1-mini
```

Requirements:

```text
1. Node 18+.
2. OPENAI_API_KEY set.
3. Network access.
```

Output is still validated against Slate block format and word budget.

If backend output is loose, ARM attempts one local repair:

```text
1. Wrap in Slate delimiters.
2. Remove code fences and duplicate titles.
3. Trim to word budget.
4. Preserve numbered findings when present.
```
