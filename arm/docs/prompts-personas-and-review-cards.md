# Prompts, Personas, and Review Cards

## Persona files

Current persona files:

- [cpo.md](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/cpo.md)
- [eng.md](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/eng.md)

These are selected by [reviewPersonas.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/reviewPersonas.ts).

Current mapping:

- `product review` -> CPO persona
- `technical review` -> engineering persona
- `everything` -> both, merged

## Review execution path

Main implementation:

- [llmReview.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/llmReview.ts)

The LLM path:

1. loads current LLM settings
2. fetches the saved API key for the selected provider
3. builds an instruction string from the persona and review rules
4. serializes the project context payload
5. calls the selected provider
6. expects JSON matching the review-card schema
7. normalizes the cards into the app’s internal format

## Card schema

Current card types:

- `question`
- `action`
- `risk`
- `decision_candidate`
- `scope_cut`
- `contradiction`

Current card statuses:

- `pending`
- `accepted`
- `rejected`
- `edited`

Each card contains:

- title
- body
- proposed update
- target section
- source agent

## Structured-output expectations

Both providers are asked to return JSON only.

The schema requires:

- top-level object with `cards`
- up to 5 cards
- structured fields for each card

If parsing fails or the provider returns an error, the app falls back to heuristic review.

## Heuristic review fallback

Fallback implementation:

- [armEngine.ts](C:/Users/clbra/OneDrive/Desktop/arm-adversarial-review-module/arm/src/core/armEngine.ts)

This engine:

- checks for missing decisions
- checks for missing references
- looks for user/goal/scope/risk gaps
- emits a small set of synthetic adversarial cards

It is intentionally lightweight and should be seen as continuity support, not as the full review intelligence layer.

## Current prompt constraints

The current provider instruction set pushes for:

- concise cards
- no long prose
- no artifact restatement
- target sections aligned to the living context document

That is directionally aligned with the product idea.

## Risks in the current prompt system

- persona quality depends entirely on the markdown prompt files
- the schema is strict, so provider changes can break parsing
- there is no prompt versioning or per-project persona override
- there is no saved review transcript beyond persisted cards
