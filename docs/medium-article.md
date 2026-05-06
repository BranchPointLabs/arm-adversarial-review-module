# ARM: Adversarial Review for Product Decisions

Most teams do not need another giant generated planning document.

They need a better way to catch weak decisions before those decisions turn into code.

ARM, the Adversarial Review Module, is a local desktop application for reviewing product ideas, PRDs, RFCs, and implementation plans before engineering work begins. It runs on Windows, macOS, and Linux, and it is designed around a simple idea: keep the human in control of the document while using AI to make the review sharper.

Instead of generating a full project plan from scratch, ARM works against the document you already have. It reads the current draft and returns small, reviewable critique cards: risks, contradictions, gaps, questions, scope cuts, actions, and possible decisions.

You can accept, reject, or edit each card. Nothing changes unless you approve it.

That distinction matters.

## The Problem With Big Generated Artifacts

AI planning systems can produce impressive output very quickly. Give them a product idea and they can generate a PRD, architecture notes, implementation stories, QA checklists, and handoff documents in one pass.

That speed is useful. It can also create a control problem.

Long generated documents are hard to audit. Important flows can be missing while the prose still looks polished. Small wording changes can shift meaning. New requirements can appear during regeneration. The user still has to inspect, maintain, and reconcile the output across the software development lifecycle.

The result is often a paradox: the tool produced more documentation, but the team has less confidence in the decisions inside it.

ARM takes the opposite approach.

It does not try to generate the project for you. It helps you interrogate the project you are already defining.

## ARM vs. BMAD

BMAD is a role-based workflow system. It uses agent-style roles like product manager, architect, developer, and QA to turn project input into broad planning artifacts: PRDs, architecture notes, stories, checklists, and implementation guidance.

That can be valuable when the goal is fast artifact generation. BMAD simulates the documents and handoffs that a software team would normally produce.

ARM is optimized for a different goal: decision control.

Rather than producing large documents, ARM produces small critique cards. Rather than asking you to audit a generated planning stack, ARM asks you to review one proposed intervention at a time. The point is not volume. The point is direction, correctness, and traceability.

Here is the practical difference:

| Behavior | BMAD | ARM |
| --- | --- | --- |
| Generates large documents | Yes | No |
| Produces small critique cards | No | Yes |
| Depends on comprehensive documentation | Yes | No |
| Works against your current document | No | Yes |
| High output volume | Yes | No |
| Fast to evaluate | No | Yes |
| Can hide missed flows in polished text | Yes | No |
| Can introduce subtle requirement drift | Yes | No |
| Requires user-approved changes | No | Yes |
| Tracks decisions, notes, and open questions | No | Yes |
| Creates a reviewable audit trail | No | Yes |
| Optimized for speed and output | Yes | No |
| Optimized for direction and correctness | No | Yes |

BMAD generates output faster.

ARM helps you produce better documentation.

## Why Critique Cards Work Better

A critique card is small enough to understand, discuss, and decide on.

That makes it different from a regenerated document section or a large planning artifact. A card has a local purpose. It might identify a contradiction, flag an unhandled edge case, propose a scope cut, or ask a question that blocks implementation.

The user can make a clear judgment:

- Is this risk real?
- Does this question need to be answered now?
- Should this requirement change?
- Is this proposed action worth accepting?

That review loop keeps authorship with the team. ARM can challenge the document, but it does not silently take over the document.

This is especially useful before code is written, when small clarifications are cheap and design errors are still reversible.

## The Better Pre-Build Workflow

The best time to find a product flaw is before it becomes a sprint commitment.

ARM is built for that moment. It sits between idea and implementation, where teams are still shaping the work and still have leverage. You bring a document. ARM reviews it adversarially. Then you decide what should change.

The workflow is intentionally restrained:

1. Open or paste a product document.
2. Run an adversarial review.
3. Inspect the generated critique cards.
4. Accept, reject, or edit each card.
5. Keep track of decisions, notes, open questions, and actions.

The output is not a wall of generated prose. It is a set of discrete review objects that can be evaluated quickly.

That makes ARM less like an artifact generator and more like a structured critique workspace.

## Local by Default

ARM is a desktop application. It is intended to run locally on Windows, macOS, and Linux.

That matters for product work because early planning documents often contain unresolved ideas, internal constraints, customer details, pricing assumptions, technical uncertainty, and strategic tradeoffs. The tool should fit into that private drafting process without forcing every review into a browser-based publishing flow.

The current project is available on GitHub:

https://github.com/BranchPointLabs/arm-adversarial-review-module

## Try It

Clone the repository:

```bash
git clone https://github.com/BranchPointLabs/arm-adversarial-review-module.git
cd arm-adversarial-review-module/arm
npm install
```

Run the desktop app in development mode:

```bash
npm run tauri dev
```

Build it for your platform:

```bash
npm run tauri build
```

Use the README for full setup details:

https://github.com/BranchPointLabs/arm-adversarial-review-module/blob/main/README.md

## Final Thought

AI can help teams move faster, but speed is not the only problem in product work.

The harder problem is knowing which decisions are correct, which assumptions are weak, which flows are missing, and which requirements should be cut before they become expensive.

ARM is built for that job.

It does not replace product judgment. It gives product judgment a sharper review surface.
