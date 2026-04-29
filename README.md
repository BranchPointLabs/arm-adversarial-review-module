# ARM

Adversarial Review Model.

ARM is a CLI-based review agent for stress-testing PRDs, RFCs, ideas, and executive artifacts before they consume serious time, money, and technical commitment.

## Core Commands

```bash
arm init
arm status
arm validate
arm review idea <file>
arm review prd <file>
arm review rfc <file>
arm review executive <file>
arm review roast <file>
arm decide <file>
arm personas list
arm personas show <name>
arm checklist <type>
```

## Local Use

```bash
npm run check
```

The current CLI is a dependency-free skeleton. It writes Slate-shaped review artifacts to `docs/arm/`.

Desktop app:

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

Useful flags:

```bash
--backend heuristic
--backend openai
--model <name>
--max-words <number>
--output <file>
--no-write
--stdin
--prompt
```

To inspect the assembled model prompt:

```bash
node ./bin/arm.js review idea examples/idea.md --prompt
```

To inspect ARM building blocks:

```bash
node ./bin/arm.js personas list
node ./bin/arm.js personas show cto
node ./bin/arm.js checklist prd
node ./bin/arm.js status
```

## Principle

BMAD helps create the plan. ARM tries to break the plan before reality does.

## Output Style

ARM uses `slate.md`: short, numbered, decision-grade output. No walls of text.

## Minimal Structure

```text
arm.config.yaml
slate.md
personas/
workflows/
schemas/
checklists/
prompts/
examples/
```

## Example

```bash
arm review idea examples/idea.md
```

Expected style: [examples/idea-review.md](examples/idea-review.md).

## Docs

- [Usage](docs/usage.md)
- [Install](docs/install.md)
- [Config](docs/config.md)
- [Backends](docs/backends.md)
- [Personas](docs/personas.md)
- [Testing](docs/testing.md)
- [Desktop](docs/desktop.md)
