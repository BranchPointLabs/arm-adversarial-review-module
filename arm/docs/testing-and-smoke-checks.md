# Testing and Smoke Checks

## Automated checks currently available

### Frontend build

```powershell
cd C:\Users\clbra\OneDrive\Desktop\arm-adversarial-review-module\arm
npm run build
```

### Rust tests

```powershell
cd C:\Users\clbra\OneDrive\Desktop\arm-adversarial-review-module\arm\src-tauri
$env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
cargo test
```

Current Rust tests are light. They mostly validate schema initialization and a helper.

## Manual smoke checks

### Project creation

1. launch desktop app
2. create a new project
3. confirm the project appears in recent projects
4. confirm local project folder and `arm.db` exist

### Document creation and editing

1. add an `IDEA` document
2. add a `PRD` document
3. open each one
4. edit markdown
5. save
6. reopen project and confirm persistence

### Notes and decisions

1. create a chat item
2. create a note item
3. create a decision item
4. confirm all appear in the sidebar and persist after reload

### References

1. add one supported text file
2. confirm extracted text/summary exist
3. toggle selected state
4. generate summary
5. remove reference

### Review flow

1. create and select a document
2. enter a product review prompt
3. confirm spinner appears
4. confirm cards are created
5. accept one card
6. edit one card
7. reject one card

### Error flow

1. break provider settings or disconnect key path
2. run review
3. confirm error appears in modal when applicable
4. confirm fallback path still works when expected

### Context update

1. accept at least one useful card
2. click `Update Context`
3. inspect draft
4. apply draft
5. confirm selected document was rewritten

## Browser-preview smoke checks

Browser preview should still be checked for:

- layout
- navigation
- modal behavior
- optimistic UX

But not for:

- true local filesystem behavior
- Tauri command correctness
- desktop base-directory resolution

## Testing gaps

- no meaningful unit coverage for frontend workflows
- no integration tests for `projectStore`
- no provider-mocked tests for `llmReview.ts`
- no end-to-end desktop smoke test harness
