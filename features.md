# ARM Features

ARM is built to help product and technical teams pressure-test documents without giving up control of the artifact.

## Core product benefits

- Keeps the document at the center of the workflow instead of replacing it with AI-generated rewrites
- Turns broad LLM feedback into small, reviewable cards that are easier to scan, compare, and act on
- Helps teams challenge assumptions, expose risks, surface open questions, and capture next steps
- Supports iterative document improvement through targeted updates instead of wholesale regeneration
- Preserves human judgment by making acceptance and resolution explicit

## Review and reasoning capabilities

- Product review support for PRDs, ideas, and early planning documents
- Technical review support for engineering risks, implementation concerns, and architecture pressure-testing
- General chat support for document-aware discussion
- Combined multi-persona review through `Everything` mode
- Structured card generation by type:
  - `info`
  - `open question`
  - `warning`
  - `action`
- Card lifecycle support with clear statuses, including pending, accepted, dismissed/rejected, edited, and resolved outcomes
- Minimum-card review behavior for deeper product and technical feedback instead of one shallow response

## Persona support

- Multiple reviewer personas built into the LLM flow
- Product-oriented personas for product critique and decision review
- Engineering-oriented personas for technical scrutiny
- General leadership/chat persona for broader discussion
- Persona-driven reviews inspired by the GStack-style workflow of using distinct lenses instead of one generic assistant voice

## Document and project support

- Multiple documents per project
- Typed documents, including `IDEA`, `PRD`, and `PLAN`
- One selected document acts as the active context for current review and editing
- Local project workspaces with persistent state across sessions
- Reference document support for supporting material and external context
- Local markdown-based editing workflow for readable, durable project artifacts

## Planning support

- Dedicated planning mode
- Focused plan mode for reducing risk and tightening execution
- Kill plan mode for testing whether an initiative should be stopped early
- Plan generation driven by selected documents and accepted signal
- Clarification/interrogation step before plan creation so plans are not generated from vague input
- Plan documents stored as first-class project artifacts

## Memory and retrieval

- Local vector memory backed by SQLite
- Automatic chunking and indexing of documents, references, and decisions
- Silent background indexing on save/update flows
- Retrieval of relevant cross-document context during review generation
- Source attribution support so cards can reference where supporting context came from
- Local retrieval without changing the user-facing workflow

## Decision and knowledge management

- Historical decision tracking inside each project
- Decision logging separate from transient chat and note content
- Notes, decisions, references, and cards stored around the active document
- Acceptance-based workflow so only approved signal becomes durable project truth
- Support for adding open questions and decisions back into the project structure

## Update model

- Patch-over-rewrite approach for document evolution
- Accepted cards can be resolved into:
  - patch updates
  - decisions
  - open questions
- Controlled document updates instead of autonomous model edits
- User-reviewed changes before project truth is updated

## LLM and provider support

- OpenAI support
- Anthropic support
- Local encrypted API-key storage on the user’s machine
- Model selection by provider
- Desktop-managed LLM settings through the app menu
- Heuristic fallback behavior when live provider calls are unavailable

## Desktop and local-first behavior

- Desktop application built with Tauri
- Local SQLite persistence
- Local file and folder reference support
- Browser fallback removed so the real product path stays aligned with the desktop runtime
- Works as a private local workspace rather than a cloud-first tool

## UX and workflow support

- Right-rail card workflow for review feedback
- Card filtering by type
- Segmented review modes for chat, product, technical, and everything flows
- Modal-based actions for project creation, document creation, settings, and card resolution
- Create-project entry points from the home screen and app menu

## Summary

ARM is designed for teams who want:

- stronger document critique
- better decision hygiene
- reusable project memory
- structured, persona-driven review
- controlled document evolution

It does not try to replace the document.

It helps you challenge it, improve it, and keep ownership of it.
