# StudyPixel Offline Personal Version Spec (Upgraded)

This document defines the **single-user, offline-first StudyPixel personal edition** for a laptop with limited memory and a small GPU. It is the source of truth for building a local-only tutor that keeps the current widget learning model, but removes the classroom/admin product shape.

## 1. Purpose

Build a personal StudyPixel version that:

- runs locally after dependencies and models are installed,
- works with one learner only,
- keeps the tutor + widget loop,
- stores progress locally,
- stays responsive on low-resource hardware,
- avoids cloud-only dependencies in the normal study flow.

This is **not** a classroom system, **not** a multi-user SaaS app, and **not** a cloud-first deployment.

## 2. Hardware budget

Treat the machine as the hard design constraint.

- GPU: NVIDIA GeForce RTX 2050
- VRAM: 4 GB
- RAM: about 8 GB total
- Power cap: around 30 W
- Use case: one learner, one session, one active model chain at a time

Design implications:

- no parallel evaluator fan-out,
- no background batch jobs while tutoring,
- short context windows,
- compact prompts and compact JSON outputs,
- no image generation by default,
- no external code execution by default,
- no heavy tabs, charts, or logs competing for memory.

## 3. What the repo already tells us

The current codebase already contains most of the building blocks, but the cloud path is still the default.

### Frontend

- `studypixel/src/app/page.js` is role-based today and should be flattened for the offline build.
- `studypixel/src/components/pixelbot/PixelBotWorkspace.js` already holds the main study loop.
- `studypixel/src/lib/firebase.js` still assumes Firebase connectivity.
- `studypixel/src/lib/dataService.js` still assumes cloud-style persistence.

### Backend

- `functions/index.js` is the production backend.
- `functions/index.local.js` is the local path reference.
- `functions/providers/llmProvider.js` exists, but the production flow does not fully depend on it yet.
- `functions/config/models.local.js` already contains local model ideas.
- `functions/seedWidgets.js` seeds widget definitions.

### Widget system

- `studypixel/src/components/pixelbot/widgets/widgetNormalizer.js` is one of the most important offline assets.
- Individual widgets already perform local validation, normalization, and telemetry capture.
- The widget system is already structured for schema drift and fallback behavior.

## 4. What the current backend is doing, and why that matters offline

The current `functions/index.js` is not a thin router. It is a multi-stage tutoring pipeline.

It currently does all of this:

1. classifies intent,
2. evaluates answers,
3. chooses whether to speak or show a widget,
4. repairs malformed LLM output,
5. updates mastery state,
6. fetches widget data,
7. sometimes uses sandbox or image services.

That is why the offline version cannot be built by swapping the model only. The whole loop has to be simplified.

The important defensive patterns already exist in the code:

- JSON parsing is hardened so the backend can recover from raw text, fenced JSON, or partial JSON.
- Model responses are scored for confidence rather than blindly trusted.
- DigitalOcean calls retry and fall back to `SPEAK` if parsing fails.
- Widget components normalize missing or renamed fields and canonicalize answers before grading.
- Telemetry is already structured enough to support local mastery tracking.

That means the offline version should **preserve the defensive logic**, but **remove cloud coupling**.

## 5. Offline architecture decision

Use a **local-first, single-user architecture**:

```text
Next.js frontend
   -> local study API / local function layer
   -> Ollama on localhost
   -> local persistence
```

Recommended shape:

- Frontend: local Next.js app
- Backend: one local Node layer or local API route
- LLM: Ollama on localhost
- Storage: local-only
- Widgets: keep the current widget architecture, but narrow the supported set
- Cloud services: optional only for migration or export, not for normal use

## 6. UI/UX for the personal offline version

The offline UX should feel like a private study desk, not a school admin console.

### Required UX shape

- no login wall on first launch,
- no teacher/student/admin navigation,
- one home screen,
- one learning workspace,
- one personal profile,
- one clear path: study, answer, review, continue.

### Recommended screens

#### Launch / Setup
- detect whether the local model runtime is available,
- let the user pick a local model,
- create or resume the personal profile.

#### Study Hub
- current topic card,
- resume session,
- review due queue,
- settings,
- export/import backup,
- reset progress.

#### Study Workspace
- left: mentor chat,
- right: widget or explanation canvas,
- bottom: small status strip for model health, session health, and progress.

### UX rules

- avoid role language,
- avoid classroom language,
- keep the layout calm and compact,
- keep the main action obvious,
- collapse logs by default,
- keep long sessions readable,
- keep a plain-text fallback available at all times.

## 7. Local model strategy

The machine cannot carry a large local model comfortably, so the model plan should be conservative.

### Recommended default strategy

Use **one small local model** for the whole tutoring loop when possible.

If a split is needed, use:

- a tiny router model,
- one main tutor model,
- no parallel calls,
- sequential calls only.

### Practical tiering

- Router / intent / lightweight JSON shaping: very small model
- Tutor / explanation / widget selection: small model
- Repair / fallback: same model as tutor, called sequentially
- Large models: not part of the default offline path

### Recommended local model families

The current spec should point to model families that have small local sizes and official Ollama support:

- `qwen2.5:0.5b` for the tiniest router-like role,
- `llama3.2:1b` for a small general-purpose text model,
- `phi3:mini` or `phi3.5:mini` for a slightly heavier reasoning-capable option,
- `qwen2.5-coder:0.5b-instruct` only if a code-oriented helper is needed,
- large models such as `llama3.3:70b` should not be treated as the offline default on this machine.

Use the smallest model that still produces stable JSON.

### Offline model policy

- prefer one model over many,
- prefer compact structured output over long prose,
- keep outputs short,
- retry once on malformed JSON,
- fall back to `SPEAK` after repair failure,
- trim context before asking the model again.

## 8. Backend behavior rules

### 8.1 Inference flow

The local backend should implement a simple flow:

1. classify the turn,
2. decide whether the turn is chat, answer checking, or widget generation,
3. call one local model sequentially,
4. repair malformed output once if needed,
5. render `SPEAK` or `USE_WIDGET`,
6. store the result locally,
7. update local mastery.

### 8.2 Output contract

The model should emit one of these actions only:

- `SPEAK`
- `USE_WIDGET`

Any unknown action should be normalized to `SPEAK`.

### 8.3 Confidence policy

Confidence should be computed from stable signals, not from raw model enthusiasm.

Good signals:
- valid action,
- valid widget ID,
- valid widget payload,
- structured mentor speech,
- consistent answer grading,
- short and parseable output.

Bad signals:
- malformed JSON,
- missing widget data,
- missing required fields,
- overly long responses,
- conflicting fields,
- hallucinated widget IDs.

### 8.4 Fallback policy

If the model fails:
- retry once with a repair prompt,
- if it still fails, show a plain tutor message,
- never block the UI,
- never freeze the session,
- never lose the current answer.

## 9. Widget policy for offline use

The widget system should stay, but the offline version should only keep widgets that are deterministic, compact, and locally validatable.

### Keep first

These are the safest first-release widgets:

- `mcq-v1`
- `mcq-reasoning-v1`
- `flashcard-v1`
- `fill-blank-v1`
- `matching-v1`
- `timeline-v1`
- `analogy-v1`
- `spaced-review-v1`

### Keep only with limits

- `diagram-generator-v1`: text-first diagrams only, hard node cap, no large graphs
- `signal-comparison-v1`: only if the prompt stays short and textual

### Disable for the first offline release

- `tactical-sandbox-v1`
- `image-analysis-v1`

Reason:
- they depend on external execution or external image availability,
- they are too fragile for a minimal offline build,
- they add unnecessary memory and failure surface.

## 10. Widget-by-widget offline rules

This section turns the widget code into a concrete offline policy.

### `mcq-v1`
Best fit for offline use.

Rules:
- keep options as a small object or array,
- validate that the correct answer key exists,
- reject empty option sets,
- prefer short prompts.

Offline behavior:
- local validation only,
- immediate grading,
- no cloud dependency.

### `mcq-reasoning-v1`
Still safe offline, but the reasoning text makes prompts larger.

Rules:
- cap reasoning length,
- keep the reasoning prompt short,
- reject malformed option structures.

Offline behavior:
- use only when the tutor genuinely needs explanation depth,
- otherwise fall back to `mcq-v1`.

### `flashcard-v1`
Very safe offline.

Rules:
- keep front/back short,
- track flip timing locally,
- do not overfit mastery to one flip.

Offline behavior:
- ideal for review loops and spaced repetition.

### `fill-blank-v1`
Very strong offline widget.

Rules:
- accept `[BLANK]` and underscore placeholders,
- canonicalize answers,
- strip articles like `a`, `an`, `the`,
- support multiple blank answers when needed,
- fail closed if the sentence has no real blanks.

Offline behavior:
- excellent for weak models because validation is deterministic.

### `matching-v1`
Offline-friendly and pedagogically strong.

Rules:
- accept `pairs`, `items`, or `terms/definitions`,
- normalize pair structure,
- drop empty or duplicate pairs,
- cap pair count.

Offline behavior:
- local validation only,
- stable IDs,
- good low-resource learning surface.

### `timeline-v1`
Good for offline use, but should stay small.

Rules:
- cap event count,
- reject empty event arrays,
- prefer short sequences,
- keep drag state compact.

Offline behavior:
- useful for sequencing and process understanding,
- should not become a large drag-and-drop board.

### `analogy-v1`
Useful and lightweight.

Rules:
- accept acceptable answers,
- handle comma-separated answers,
- canonicalize for punctuation, spacing, and articles,
- keep the prompt concise.

Offline behavior:
- good for concept transfer,
- should avoid verbose answer sets.

### `spaced-review-v1`
Important for the personal offline version.

Rules:
- store retention locally,
- allow empty queue states,
- if BKT state is missing, use a simple local heuristic,
- never depend on Firestore reads during normal use.

Offline behavior:
- drives review scheduling,
- should degrade gracefully if mastery data is sparse.

### `diagram-generator-v1`
Keep only in text-first form.

Rules:
- cap node and edge counts,
- reject overly large graphs,
- prefer simple layouts,
- treat it as a structured explanation tool, not as a real graphics engine.

Offline behavior:
- good substitute for image-based explanations,
- should stay compact to avoid memory pressure.

### `signal-comparison-v1`
Useful, but more fragile than core widgets.

Rules:
- keep signals short,
- avoid long free-text outputs,
- reject malformed input,
- use it only when comparison adds clear value.

Offline behavior:
- optional, not core.

### `tactical-sandbox-v1`
Do not include in the first offline build.

Reason:
- it depends on server-side execution,
- it assumes remote callable functions,
- it is not safe to fake.

Offline fallback:
- static analysis only,
- pseudocode help,
- or a disabled widget with an explanation.

### `image-analysis-v1`
Do not include unless local images are truly part of the offline workflow.

Reason:
- the widget itself is UI-local,
- but useful only when image input is available,
- otherwise it adds failure without benefit.

Offline fallback:
- hide it,
- or allow only local file input later.

## 11. Why the widget code is defensive

The widget layer is already doing the right kind of protection.

The offline spec should explicitly keep these ideas:

- `normalizeBaseData` because model output often renames fields like `prompt`, `hint`, `explanation`, or `studentAnswer`,
- `canonicalize` because answer checking should ignore punctuation, spacing, and case,
- `buildTelemetry` because hesitation and response time are useful local learning signals,
- local validation because the user should get immediate feedback even with no network.

The important point is that the offline build should keep the same defensive structure, but write telemetry locally instead of sending it to a cloud backend.

## 12. Local storage

For the personal offline build, local storage must be the default.

### Recommended storage path

- Browser-first build: `IndexedDB` for history and progress, `localStorage` for tiny settings
- Packaged desktop build later: `SQLite` behind the same repository interface

### Stored data

- personal profile,
- topic history,
- widget submissions,
- mastery estimates,
- review queue,
- session summaries,
- local settings,
- export/import backups.

### Storage rules

- keep the schema stable,
- normalize records on load,
- ignore malformed entries,
- never block study because one record is corrupted,
- provide a reset path and a backup export path.

## 13. Emulators

Firebase emulators should not be the core offline dependency.

Use them only if they help during migration.

For the final personal offline version:

- local persistence is preferred,
- emulators are optional,
- the app must still work without them,
- no emulator requirement should be allowed to block normal study.

## 14. Codebase changes required

### Backend

- wire `functions/providers/llmProvider.js` into the main path,
- stop calling cloud inference directly from `functions/index.js`,
- make `LLM_MODE=local` actually switch the provider,
- keep `index.local.js` as a reference or temporary fallback.

### Frontend

- remove role-based routing from the offline path,
- simplify `studypixel/src/app/page.js`,
- make `PixelBotWorkspace` the main personal workspace,
- connect `firebase.js` to local mode only if needed,
- make `dataService.js` store local data first.

### Widget layer

- keep `widgetNormalizer.js`,
- keep local validation in widgets,
- enforce smaller payloads,
- make `SPEAK` the safe fallback,
- seed only the widgets that are actually used.

## 15. Resource budget rules

The offline tutor should obey these rules at all times:

- one model chain at a time,
- no fan-out across multiple LLMs,
- no parallel evaluators,
- no heavy background sync,
- no code execution unless explicitly added later,
- no image generation unless explicitly added later,
- no large widget payloads,
- no long chat context without summarization.

## 16. Recovery paths

The offline version should fail gracefully.

### Model/runtime failures
- Ollama not running: show a local banner and a retry button
- model missing: show the exact model name needed
- slow model loading: keep the UI responsive and show `Starting...`
- malformed JSON: repair once, then fall back to `SPEAK`
- context overflow: summarize older turns and trim history

### Storage failures
- corrupt local record: skip it and keep the session alive
- corrupted session file: allow reset and import
- missing widget state: render a safe placeholder instead of crashing

### Widget failures
- no options in MCQ: reject and regenerate
- no blanks in fill-in-the-blank: reject and regenerate
- mismatched matching pairs: fall back to a simpler widget
- too many timeline events: truncate or regenerate
- oversized diagram: cap the graph and warn
- sandbox unavailable: disable execution and explain why

### UX rules for failure
- never strand the user on a blank screen,
- always keep a text tutor fallback,
- always preserve the last good session state,
- always provide a way back to the main workspace.

## 17. Prompting rules for the local model

- require JSON only when structured output is needed,
- keep prompts short,
- keep output tokens small,
- prefer a single action field,
- repair malformed JSON once,
- fall back to `SPEAK` after repair failure,
- trim chat history before every new call.

### Recommended prompt policy

- simple reply: one call
- answer checking: one call
- widget generation: one call
- high-risk or ambiguous turn: one call, then repair if needed
- meta question: skip heavy assessment logic

## 18. Implementation order

1. flatten the UI into a single personal study path,
2. wire local storage,
3. wire local model selection,
4. keep `SPEAK` and core widgets only,
5. remove cloud-only dependencies from the normal runtime,
6. shrink history and session logs,
7. add session summaries,
8. add export/import backup,
9. test on the low-resource target machine,
10. only then consider optional extras.

## 19. Acceptance criteria

The offline personal version is complete when:

- it opens locally without internet after setup,
- it works with one learner only,
- it stores and reloads progress locally,
- it can run the tutor loop locally,
- it can render widgets without cloud dependencies,
- it does not require login,
- it does not expose teacher or admin flows,
- it remains usable on the target hardware without crashing in normal single-user use.

## 20. Final direction

The right offline version is a **small personal tutor** with:

- local inference,
- local persistence,
- sequential model use,
- compact widgets,
- strict fallback behavior,
- and a calm, single-user UX.

The safest implementation choice is to preserve the widget architecture and the defensive parsing logic, while stripping out cloud-only features and classroom workflow.
