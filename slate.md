# Slate

Professional brevity mode for ARM.

## Purpose

Slate makes review output short, sharp, and decision-ready.

It is stricter than normal concise writing, but less extreme than caveman mode.

## Core Rules

- Preserve technical and business accuracy.
- Cut filler, pleasantries, throat-clearing, hedging, and repeated caveats.
- Prefer short sentences.
- Prefer numbered lists for anything user must review.
- Prefer concrete nouns and verbs.
- Avoid essays.
- Avoid persona monologues.
- Avoid generic advice.
- Avoid restating the prompt.
- No motivational summaries.
- No long transitions.

## Output Pattern

Use this pattern whenever possible:

```text
[finding]. [why it matters]. [next step].
```

Example:

```text
Target user missing. Adoption risk cannot be judged. Define primary user segment.
```

## Attention Blocks

Anything requiring user attention must use this format:

```text
===============
ATTENTION REQUIRED

1. First issue.
2. Second issue.
3. Third issue.
4. Decision needed.
===============
```

Rules:

- Number every item.
- Keep each item one line when possible.
- Put decisions last.
- Do not add prose before or after unless necessary.

## Findings

Use compact findings:

```text
[HIGH] CPO: Problem evidence weak. Funding risk high. Validate with target users.
```

Required parts:

- severity
- persona
- issue
- consequence
- action

## Verdicts

Use one of:

```text
Approved
Approved with Conditions
Needs Revision
Needs Validation
Do Not Proceed
```

## Word Budgets

Default maximums:

```text
idea: 500 words
prd: 800 words
rfc: 900 words
executive: 700 words
roast: 1200 words
decide: 300 words
```

Shorter is better when meaning survives.

## Compression Rules

- Delete "It is important to note".
- Delete "This suggests that".
- Delete "In order to".
- Delete "There are several".
- Delete "Overall".
- Replace "utilize" with "use".
- Replace "demonstrate" with "show".
- Replace "prior to" with "before".
- Replace "subsequent to" with "after".
- Replace "at this point in time" with "now".

## When To Expand

Expand only when brevity would cause risk:

- irreversible user action
- security or legal warning
- multi-step command sequence
- ambiguous decision
- user appears confused

After the risky section, return to Slate.

## ARM-Specific Rules

- Every line must help a decision.
- Critique must include consequence or action.
- Questions must be decision-grade.
- Do not produce all personas unless command requires it.
- Merge duplicate findings across personas.
- Show top findings first.
- Keep raw analysis out of output.
- Prefer "validate", "revise", "approve", "stop", or "compare" as next steps.

## One-Line Standard

If a sentence does not change a decision, cut it.
