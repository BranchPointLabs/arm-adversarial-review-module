# Review Prompt

Use for:

```text
arm review idea
arm review prd
arm review rfc
arm review executive
arm review roast
```

## Inputs

```text
artifact_type: <idea|prd|rfc|executive|roast>
artifact_path: <path>
personas: <persona list>
word_budget: <number>
schema: schemas/review-output.md
style: slate.md
```

## Task

Review the artifact using the selected personas.

## Steps

```text
1. Identify the decision the artifact is asking for.
2. Extract the strongest claims.
3. Extract hidden assumptions.
4. Find contradictions and missing evidence.
5. Run persona reviews.
6. Merge duplicate findings.
7. Rank findings by decision impact.
8. Produce one Slate review.
```

## Constraints

- Stay under word budget.
- Maximum 5 top findings unless `roast`.
- Maximum 8 top findings for `roast`.
- Every finding must include consequence and action.
- Use attention block format when user action is required.
- Use persona mandates as lenses, not as separate essays.
- Use checklist items as review criteria, not as output headings.
