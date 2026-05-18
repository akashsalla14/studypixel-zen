# Troubleshooting

This guide is for fixing StudyPixel Zen without losing local progress.

Always prefer recovery in this order:

1. Recheck runtime.
2. Switch to a smaller model.
3. Trim/summarize session context.
4. Export backup.
5. Restart Ollama and Zen.
6. Reset only as a last resort.

## Quick Diagnosis Table

| Symptom | Likely Cause | First Fix |
| --- | --- | --- |
| Setup shows Offline Fallback | Ollama is not running | start Ollama and recheck |
| Model test fails | selected model missing or loading slowly | pull model or switch model |
| Tutor replies with fallback text | local inference failed or malformed output | retry once, then smaller model |
| Widgets do not render | model emitted invalid widget payload | continue with SPEAK fallback |
| App feels slow | memory pressure or model too large | use `qwen2.5:0.5b` |
| Data missing after refresh | storage blocked or local state corrupt | import backup |
| `npm run dev` fails in PowerShell | script execution policy | use `npm.cmd run dev` |
| `npm run lint` fails before linting | ESLint 9 config missing | add `eslint.config.*` |

## Ollama Not Running

Symptoms:

- Setup shows `Offline Fallback`.
- Model dropdown may be empty.
- Model test fails.
- Tutor API returns fallback `SPEAK`.

Check:

```powershell
curl http://localhost:11434/api/tags
```

Fix:

1. Start the Ollama desktop app.
2. Wait a few seconds.
3. Run the health check again.
4. Click `Recheck runtime` in Setup.

If Ollama still fails:

- restart the machine
- open Ollama again
- avoid running another local model server on the same port

## Model Missing

Symptoms:

- Setup shows `Model Missing`.
- Ollama is reachable, but the chosen model is not listed.

Fix:

```powershell
ollama pull qwen2.5:0.5b
```

Other options:

```powershell
ollama pull llama3.2:1b
ollama pull phi3:mini
ollama pull phi3.5:mini
```

Then:

1. Click `Recheck runtime`.
2. Select the installed model.
3. Run `Test model`.

## Model Loads But Times Out

Symptoms:

- Setup briefly waits, then reports timeout.
- Tutor call fails after a long delay.

Likely causes:

- model is too large
- system RAM is under pressure
- GPU VRAM is exhausted
- other apps are using the GPU

Fix:

1. Switch to `qwen2.5:0.5b`.
2. Close heavy apps and extra browser tabs.
3. Restart Ollama.
4. Restart Zen.
5. Try model test again.

## VRAM Exhaustion

Symptoms:

- error text mentions CUDA, VRAM, memory, or out of memory
- model starts then crashes
- local tutor becomes unreliable after several turns

Fix:

- use `qwen2.5:0.5b`
- keep one active Zen tab
- avoid running other local LLM tools
- avoid optional heavy widgets
- trim session history
- restart Ollama after a failed large model load

Design note:

Zen serializes model calls and avoids council fanout. If VRAM exhaustion still happens, the model is probably too large for the current machine state.

## Malformed JSON From Model

Symptoms:

- model responds, but widget does not appear
- tutor says it will continue in plain text
- output looks conversational instead of JSON

Expected behavior:

1. Zen tries raw JSON.
2. Zen tries fenced JSON.
3. Zen tries brace-depth object extraction.
4. Zen asks the model once to repair the output.
5. Zen falls back to `SPEAK`.

Fix:

- continue studying
- use smaller/clearer prompts
- use a slightly stronger model if available
- avoid asking for many widget types in one turn

This is a recovery path, not a fatal error.

## Widget Payload Invalid

Symptoms:

- tutor chooses a widget but Zen renders plain text instead
- widget area remains stable rather than crashing

Likely causes:

- missing MCQ options
- bad correct answer key
- empty matching pairs
- no fill-blank answers
- diagram with too few nodes
- disabled widget selected by model

Fix:

- ask: `make a simple multiple choice question`
- ask: `try that again as a flashcard`
- switch model if the issue repeats

Zen should never crash because a model emitted a bad widget payload.

## Storage Or Backup Problems

Symptoms:

- state does not persist after refresh
- imported backup fails
- sessions look missing

Storage layers:

1. IndexedDB primary state.
2. localStorage snapshot fallback.
3. exported JSON backup.

Fix:

1. Export a backup if possible.
2. Refresh the page.
3. Import a known-good backup.
4. If import fails, inspect whether the file is valid JSON.
5. Reset only if the local state cannot be recovered.

Backup files should contain:

- profile
- settings
- sessions
- session archive
- review queue
- mastery
- history
- summaries
- widget submissions

## PowerShell Blocks npm

Symptom:

```text
npm.ps1 cannot be loaded because running scripts is disabled
```

Fix:

```powershell
npm.cmd run dev
```

Use `.cmd` for other npm commands too:

```powershell
npm.cmd install
npm.cmd run build
```

## Lint Does Not Start

Current known issue:

```text
ESLint couldn't find an eslint.config.(js|mjs|cjs) file.
```

Cause:

- project uses ESLint 9, which expects the new flat config file.

Impact:

- this does not mean the app failed lint rules
- lint cannot start until config exists

Temporary verification:

```powershell
npm.cmd run build
```

Build currently succeeds.

## Next Build Problems

Run:

```powershell
npm.cmd run build
```

If build fails:

- read the first actual source error
- check recently edited imports
- check whether a component was moved
- check whether a browser-only API is used on the server

Common browser-only APIs:

- `window`
- `indexedDB`
- `localStorage`

These must be guarded behind `typeof window !== 'undefined'`.

## Legacy Folder Deletion Problems

If deleting `studypixel` or `functions` breaks Zen:

1. Search Zen source:

```powershell
rg "studypixel|functions|firebase|Firestore|evaluateWithCouncil|Judge0" src
```

2. Any runtime import from old folders must be replaced with Zen-local code.
3. Check `MD/DELETE_READINESS_CHECKLIST.md`.
4. Check `MD/MIGRATION_WHAT_IF_EDGE_CASE_ANALYSIS.md`.

Expected result:

- Zen should not need either old folder at runtime.

## Safe Reset Procedure

Only reset when you have accepted that current local state can be discarded.

Recommended:

1. Export backup.
2. Save backup somewhere outside the project folder.
3. Reset profile/progress from Settings.
4. Re-seed topics from Setup.
5. Test model again.

## When To Stop And Inspect Code

Inspect code if:

- build fails
- storage consistently corrupts backups
- tutor API always fails even though Ollama health works
- every widget falls back to `SPEAK`
- deletion of old folders breaks runtime

Start with:

- `src/app/api/tutor/route.js`
- `src/model/ollamaClient.js`
- `src/tutor/contract.js`
- `src/widgets/widgetPolicy.js`
- `src/storage/zenStorage.js`
