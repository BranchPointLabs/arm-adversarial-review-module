# Decide Prompt

Use for:

```text
arm decide <file>
```

## Inputs

```text
artifact_path: <path>
personas: critic, cpo, cto
word_budget: 300
schema: schemas/decision-output.md
style: slate.md
```

## Task

Produce a decision recommendation.

## Steps

```text
1. Identify the requested decision.
2. Judge evidence quality.
3. Judge business readiness.
4. Judge technical readiness.
5. Return verdict, confidence, reasons, and next gate.
```

## Constraints

- No more than 3 reasons.
- No more than 1 next gate.
- Do not include a full review.
