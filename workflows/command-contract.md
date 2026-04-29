# Command Contract

Every ARM command follows this contract.

## Inputs

```text
artifact path
command intent
config
personas
style
```

## Steps

```text
1. Read artifact.
2. Classify artifact unless command already defines type.
3. Extract claims.
4. Extract assumptions.
5. Run required personas.
6. Merge duplicate findings.
7. Rank by decision impact.
8. Produce Slate output.
9. Write review artifact.
```

## Output Rules

- Use `slate.md`.
- Use `schemas/review-output.md` or `schemas/decision-output.md`.
- Respect word budget.
- Box attention-required output.
- Never emit raw chain-of-thought.

## Default Output Path

```text
docs/arm/<input-name>-<command>.md
```
