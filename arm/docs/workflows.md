# Workflows

## 1. Create a project

From the app bar:

- `Projects -> New Project...`

Flow:

1. user enters a project name
2. app creates the project through `projectStore.createProject`
3. desktop mode creates a real folder and SQLite database
4. browser preview mode creates an in-browser project record
5. app navigates to the new project workspace

## 2. Select a project

From the app bar:

- `Projects -> Select Project...`

Flow:

1. app loads the project list
2. user filters/selects a project
3. app navigates to `/p/:projectPath/context`
4. workspace loads documents, notes, decisions, references, and cards

## 3. Create a document

From the left rail:

- `Add Document`

Flow:

1. user provides a document name
2. user selects `IDEA` or `PRD`
3. app creates the document
4. app navigates to `/documents/:documentId`
5. new document markdown is seeded from a template

## 4. Edit the active document

Flow:

1. user selects a document
2. document content loads into the center editor
3. user edits markdown
4. user clicks `Save Document`
5. app persists the markdown

Desktop mode also mirrors that saved content into `context/CURRENT_CONTEXT.md`.

## 5. Add chat notes

In the unified sidebar:

1. switch composer to `Chat`
2. enter text
3. click `Submit`
4. app stores a chat note tagged for chat history

## 6. Add sticky notes

In the unified sidebar:

1. switch composer to `Note`
2. enter text
3. click `Submit`
4. app stores a chat note with the `note` tag

The app currently models notes as chat notes with a tag distinction.

## 7. Add a decision

There are two paths:

1. sidebar composer in `Decision` mode
2. `Add Decision` modal action

Both end by writing to the decisions collection for the project.

## 8. Add references

In the references view:

1. drag files onto the drop zone
2. or use `Add Files`
3. or use `Add Folder`
4. app reads supported text files
5. app stores extracted text and a short summary
6. user can toggle each reference as selected/unselected

Reference handling is currently text-oriented.

## 9. Run a review

In the unified sidebar:

1. switch composer to `Review`
2. choose `product review`, `technical review`, or `everything`
3. submit the prompt
4. app shows a spinner while the request runs
5. if provider-backed review is configured, it tries that first
6. if provider-backed review fails, app falls back to the heuristic review engine
7. generated cards are stored and shown in the sidebar

## 10. Process review cards

For each card:

- `Accept`
- `Reject`
- `Edit`

Accepted and edited cards feed the next context rewrite.

## 11. Update context

User action:

- `Update Context`

Flow:

1. app collects decisions, cards, and selected references
2. app generates a replacement draft
3. app opens that draft in a modal editor
4. user can cancel or apply it
5. if applied, the selected document is rewritten

This is one of the app’s most important workflows.

## 12. Configure LLM settings

From:

- `File -> LLM Settings`

Flow:

1. choose provider
2. choose model
3. add API key
4. save key
5. key is stored locally in encrypted form

There is also a `Delete All Keys` action.
