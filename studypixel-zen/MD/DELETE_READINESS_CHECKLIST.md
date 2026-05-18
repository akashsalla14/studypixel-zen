# Delete Readiness Checklist

Use this checklist before deleting the original `studypixel` and `functions` folders.

Deletion target:

```text
StudyPixel-main/studypixel
StudyPixel-main/functions
```

Keep:

```text
StudyPixel-main/studypixel-zen
```

## Read This First

Do not delete old folders just because the code looks migrated. Delete them only after:

- Zen builds.
- Zen opens.
- Zen works without old imports.
- Zen can recover when Ollama is unavailable.
- Zen can use at least one installed local model.
- Zen can export/import backup.
- core widgets render.

You have not installed local LLMs yet, so the final model-dependent checks are still pending.

## Current Source Dependency Checks

Already confirmed:

- Widget imports point to `studypixel-zen/src/widgets/components`.
- No `studypixel/src/...` imports remain in Zen source.
- No `functions/...` runtime imports remain in Zen source.
- Tutor API calls local Ollama only through `src/model/ollamaClient.js`.
- Tutor API serializes local LLM calls.
- Tutor API falls back to `SPEAK` after malformed JSON repair fails.
- Widget policy is local.
- Local storage does not require Firestore.
- Tactical sandbox does not require Firebase Functions in normal runtime.
- Tactical sandbox and image analysis are disabled by initial offline policy.
- Diagram generator and signal comparison are optional and memory-aware.

Useful command:

```powershell
rg "studypixel/src|functions/|firebase|Firestore|evaluateWithCouncil|DigitalOcean|Gemini|OpenAI|Judge0" src
```

Expected result:

- no runtime source matches, except harmless text in docs if you search outside `src`.

## Build Checks

Run from `studypixel-zen`:

```powershell
npm.cmd run build
```

Expected:

- production build succeeds
- route list includes `/` and `/api/tutor`

Known lint note:

```powershell
npm.cmd run lint
```

At the time of this audit, lint cannot start because ESLint 9 requires `eslint.config.*`. This is a tooling config issue, not proof of a runtime failure.

## Offline Runtime Checks Before Installing Models

These can be run before local LLM installation:

1. Start Zen:

```powershell
npm.cmd run dev
```

2. Open:

```text
http://localhost:3000
```

3. Confirm Setup opens.
4. Confirm `Recheck runtime` does not crash.
5. Confirm missing Ollama/model shows a readable state.
6. Confirm profile fields can be edited.
7. Confirm settings can be opened.
8. Confirm backup export button is available.

Expected:

- Zen should not crash just because local models are not installed yet.

## Ollama Checks Before Deletion

Install Ollama and one model first:

```powershell
ollama pull qwen2.5:0.5b
```

Health check:

```powershell
curl http://localhost:11434/api/tags
```

Expected:

- JSON containing `qwen2.5:0.5b`.

Zen checks:

1. Open Setup.
2. Click `Recheck runtime`.
3. Select `qwen2.5:0.5b`.
4. Click `Test model`.
5. Confirm state becomes Ready.

## Tutor Checks Before Deletion

Use short prompts:

```text
Teach me photosynthesis in three short steps.
```

Expected:

- Tutor returns a plain `SPEAK` response.
- No raw stack trace.
- Diagnostics strip remains readable.

Then test JSON/widget behavior:

```text
Make a simple multiple choice question about photosynthesis.
```

Expected:

- MCQ widget renders, or Zen falls back to plain text safely.
- No crash if model emits malformed widget data.

## Core Widget Checks

Verify these widgets can render or fail safely:

- `mcq-v1`
- `mcq-reasoning-v1`
- `flashcard-v1`
- `fill-blank-v1`
- `matching-v1`
- `timeline-v1`
- `analogy-v1`
- `spaced-review-v1`

Optional:

- `diagram-generator-v1`
- `signal-comparison-v1`

Disabled initially:

- `tactical-sandbox-v1`
- `image-analysis-v1`

Expected:

- disabled widgets should not be selected by normal policy
- malformed payloads should become `SPEAK`
- workspace should never hard-crash

## Storage Checks

Before deletion:

1. Create or edit profile.
2. Send at least one tutor message.
3. Complete at least one widget if possible.
4. Refresh browser.
5. Confirm state persists.
6. Export backup JSON.
7. Import that same backup.
8. Confirm state remains valid.

Expected backup fields:

- profile
- settings
- sessions
- sessionArchive
- reviewQueue
- mastery
- history
- summaries
- widgetSubmissions

## Deletion Procedure

Recommended safe procedure:

1. Export Zen backup.
2. Stop dev server.
3. Rename old folders first instead of deleting:

```powershell
Rename-Item "..\studypixel" "studypixel_OLD_PENDING_DELETE"
Rename-Item "..\functions" "functions_OLD_PENDING_DELETE"
```

4. Start Zen again:

```powershell
npm.cmd run dev
```

5. Re-run setup, tutor, widget, and storage checks.
6. If everything works, delete renamed folders later.

Why rename first:

- it proves Zen no longer depends on those paths
- it gives an easy rollback if a missed dependency appears

## Post-Deletion Checks

After old folders are gone:

1. Run build:

```powershell
npm.cmd run build
```

2. Run source scan:

```powershell
rg "studypixel|functions|firebase|Firestore|evaluateWithCouncil|Judge0" src
```

3. Start dev server.
4. Open Setup.
5. Test model.
6. Run one tutor prompt.
7. Export backup.

## Rollback If Something Breaks

If you renamed instead of deleted:

```powershell
Rename-Item "..\studypixel_OLD_PENDING_DELETE" "studypixel"
Rename-Item "..\functions_OLD_PENDING_DELETE" "functions"
```

Then inspect:

- import path errors
- missing widget file errors
- old Firebase references
- missing docs-only assumptions

## Do Not Delete Yet If

Do not delete old folders if:

- Zen build fails.
- Zen page does not open.
- `/api/tutor` fails to compile.
- Setup crashes when Ollama is missing.
- backup export/import fails.
- old-folder source scan finds runtime imports.
- no local model has been tested yet.

## Final Delete Approval

Deletion is safe when all are true:

- build passes
- setup opens
- Ollama health works
- at least one small model test passes
- tutor returns `SPEAK`
- widget prompt either renders a widget or safely falls back
- storage persists after refresh
- backup export/import works
- old folders can be renamed without breaking Zen

Only then delete `studypixel` and `functions`.
