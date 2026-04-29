# Usage

## Core

```bash
node ./bin/arm.js status
node ./bin/arm.js validate
node ./bin/arm.js review idea examples/idea.md
node ./bin/arm.js review prd <file>
node ./bin/arm.js review rfc <file>
node ./bin/arm.js review executive <file>
node ./bin/arm.js review roast <file>
node ./bin/arm.js decide <file>
```

## Output

Default output path:

```text
docs/arm/
```

Use custom output:

```bash
node ./bin/arm.js review idea examples/idea.md --output docs/arm/custom.md
```

Print only:

```bash
node ./bin/arm.js review roast examples/idea.md --no-write
```

## Prompt Inspection

```bash
node ./bin/arm.js review idea examples/idea.md --prompt
node ./bin/arm.js decide examples/idea.md --prompt
```

## Stdin

```bash
Get-Content examples/idea.md | node ./bin/arm.js review idea --stdin
```

## Validation

```bash
node ./bin/arm.js validate
node ./scripts/smoke-test.js
```

## Word Budget

```bash
node ./bin/arm.js review roast examples/idea.md --max-words 500
```

ARM repairs loose output before failing validation.
