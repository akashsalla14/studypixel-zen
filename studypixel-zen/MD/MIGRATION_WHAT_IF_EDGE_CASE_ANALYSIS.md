# Migration What-If and Edge-Case Analysis

Last audit: 2026-05-18

This document records the legacy StudyPixel behavior audited before deleting the old `functions` and `studypixel` folders, and maps what has been migrated or intentionally replaced inside `studypixel-zen`.

The goal is not to preserve the old SaaS/cloud runtime. The goal is to preserve the useful learning architecture while making Zen a single-user, offline-first, local-LLM study app.

## Files Audited

### Legacy backend

- `functions/index.js`
  - Online Firebase Functions runtime.
  - Uses Gemini, OpenAI, DigitalOcean, Firestore, Firebase Auth, admin workflows, rate limits, widget seeding, telemetry capture, prompt sanitization, robust JSON extraction, confidence scoring, widget validation, BKT updates, matching validation, and adaptive profile analysis.
- `functions/index.local.js`
  - Ollama experiment that mirrors the cloud function flow.
  - Important preserved ideas: local Ollama calls, sequential evaluator execution, small token caps, parse retry, local model failure fallback, widget-response prompt-injection containment, telemetry extraction, BKT update logic, and validation before rendering widgets.
- `functions/providers/llmProvider.js`
  - Provider abstraction for cloud/local switching.
  - Important preserved ideas: provider boundary, local OpenAI-compatible endpoint, cloud fallback chain, JSON extraction, provider failure fallback to `SPEAK`.
- `functions/config/models.local.js`
  - Local model strategy and hardware profile source.
- `functions/widgetNormalizer.js`
  - `normalizeBaseData`, `canonicalize`, and `buildTelemetry`.
- `functions/seedWidgets.js` and widget seeding definitions in `functions/index.js`
  - Widget schema source of truth and validation expectations.

### Legacy frontend

- `studypixel/src/app/page.js`
  - Old role/login entry path.
- `studypixel/src/components/pixelbot/PixelBotWorkspace.js`
  - Original tutor workspace and widget rendering loop.
- `studypixel/src/lib/firebase.js`
  - Old Firebase coupling.
- `studypixel/src/lib/dataService.js`
  - Old cloud data service assumptions.
- `studypixel/src/components/pixelbot/widgets/*.js`
  - Widget implementations and component contracts.

### Documentation

- `LOCAL_LLM_SETUP.md`
- `functions/README.local.md`
- `WIDGET_SPECIFICATIONS.md`
- `STUDYPIXEL_OFFLINE_PERSONAL_SPEC.md`
- `STUDYPIXEL_OFFLINE_PERSONAL_SPEC_UPGRADED.md`

## Migration Result Summary

Zen is currently designed so `studypixel` and `functions` can be deleted after final runtime checks.

Confirmed by source scan:

- No Zen source imports from `studypixel/src/...`.
- No Zen source imports from `functions/...`.
- No Zen runtime dependency on Firebase, Firestore, Firebase Functions, DigitalOcean, Gemini, OpenAI, Judge0, or cloud auth.
- Widget components were copied into `studypixel-zen/src/widgets/components`.
- All widget component hashes match the legacy widget files except `TacticalSandboxWidget.js`, which was intentionally changed for offline/local behavior.
- `widgetNormalizer.js` is present in the migrated widget component directory and the reusable normalization logic has also been moved into `src/normalization/widgetNormalization.js` and `src/tutor/contract.js`.

## What Was Migrated Into Zen

### Local runtime

- `src/model/ollamaClient.js`
  - Detects Ollama via `http://localhost:11434/api/tags`.
  - Calls Ollama through the OpenAI-compatible endpoint at `http://localhost:11434/v1/chat/completions`.
  - Uses compact defaults: low temperature, `max_tokens` around 420, request timeout.
  - Classifies failure states:
    - Ollama not running
    - Model Missing
    - Inference timeout
    - Context overflow
    - VRAM exhaustion
    - Error

### Tutor API

- `src/app/api/tutor/route.js`
  - Replaces `functions.evaluateWithCouncil` for the offline personal edition.
  - Uses only local Ollama.
  - Serializes all tutor calls through a module-level queue, preserving the `index.local.js` low-VRAM rule: one model request chain at a time.
  - Trims chat history before sending it to the model.
  - Attempts normal parse, then one repair request, then falls back to `SPEAK`.
  - Returns a readable failure state instead of throwing raw backend failures into the workspace.

### Tutor contract and defensive JSON handling

- `src/tutor/contract.js`
  - Migrates the robust `parseLlmJson` strategy:
    - raw JSON parse
    - fenced JSON extraction
    - brace-depth object extraction
  - Adds the required offline repair step:
    - retry once with a compact repair prompt
    - fall back to `SPEAK` if repair fails
  - Enforces the final response contract:
    - `{ "action": "SPEAK", "mentor_speech": "..." }`
    - `{ "action": "USE_WIDGET", "widgetId": "...", "widgetData": {} }`
  - Unknown actions and bad widget payloads are normalized back to `SPEAK`.

### Widget policy

- `src/widgets/widgetPolicy.js`
  - Required widgets:
    - `mcq-v1`
    - `mcq-reasoning-v1`
    - `flashcard-v1`
    - `fill-blank-v1`
    - `matching-v1`
    - `timeline-v1`
    - `analogy-v1`
    - `spaced-review-v1`
  - Optional widgets:
    - `diagram-generator-v1`
    - `signal-comparison-v1`
  - Disabled initially:
    - `tactical-sandbox-v1`
    - `image-analysis-v1`
  - Optional/heavy widgets are removed when memory pressure is high.

### Widget components

Migrated into `src/widgets/components`:

- `MCQWidget.js`
- `MCQReasoningWidget.js`
- `MCQBaseWidget.js`
- `FlashcardWidget.js`
- `FillBlankWidget.js`
- `MatchingWidget.js`
- `TimelineWidget.js`
- `AnalogyWidget.js`
- `SpacedReviewWidget.js`
- `DiagramGeneratorWidget.js`
- `SignalComparisonWidget.js`
- `ImageAnalysisWidget.js`
- `TacticalSandboxWidget.js`
- `widgetNormalizer.js`

Important migration note:

- `TacticalSandboxWidget.js` differs from the old hash by design. The old path expected cloud/server execution. Zen keeps the file available but the widget is disabled initially because the offline personal edition must not depend on Judge0 or remote code execution.

### Normalization, canonicalization, telemetry

- `src/normalization/widgetNormalization.js`
  - Preserves and improves:
    - `normalizeBaseData`
    - `canonicalize`
    - loose canonicalization with article/punctuation tolerance
    - string-to-array coercion
- `src/telemetry/buildTelemetry.js`
  - Preserves local telemetry structure:
    - widget id/version
    - timestamp
    - correctness
    - hint use
    - interaction source
    - compact metrics

### Local storage and recovery

- `src/storage/zenStorage.js`
  - IndexedDB primary persistence.
  - localStorage snapshot fallback.
  - Stores:
    - profile
    - settings
    - sessions
    - archived sessions
    - review queue
    - mastery
    - history
    - summaries
    - widget submissions
  - Sanitizes imported or corrupted state.
  - Supports export/import/reset.

### Session and memory management

- `src/session/sessionManager.js`
  - Compacts chat history.
  - Summarizes older turns.
  - Infers memory pressure from session size.
  - Rolls old sessions into an archive.

## Online LLM Behavior: What Was Preserved Without Cloud Dependency

The old online system had provider fallback and multi-role evaluation. Zen intentionally removes cloud calls, but preserves the safety behaviors.

| Old online behavior | Zen replacement |
| --- | --- |
| Gemini/OpenAI/DigitalOcean calls | Local Ollama call only |
| Provider fallback chain | Local failure classification plus `SPEAK` fallback |
| Parse retry in provider calls | Parse + repair retry in `src/app/api/tutor/route.js` |
| Confidence scoring | Deterministic widget validation plus local mastery heuristics |
| Firestore widget definitions | Local widget policy and local component registry |
| Firestore telemetry | Local telemetry in IndexedDB/localStorage state |
| Firebase auth/admin gates | Removed for single-user personal runtime |
| Rate limits | Not needed for single local user; sequential queue prevents local overload |
| Admin system-test bypass | Removed from user-facing offline runtime |
| Cloud adaptive profile analysis | Local session summaries and mastery state |
| Judge0 execution | Disabled with tactical sandbox initially off |

## Offline LLM Behavior Preserved From `functions/index.local.js`

Zen preserves these local-runtime rules:

- One active model request chain at a time.
- No parallel LLM fanout.
- No default council fanout.
- Compact prompt.
- Compact JSON output.
- Small-model defaults:
  - `qwen2.5:0.5b`
  - `llama3.2:1b`
  - `phi3:mini`
  - `phi3.5:mini`
- Model request timeout.
- Model missing and Ollama-not-running states.
- Malformed JSON fallback.
- Widget-response safety through local validation before rendering.

## What Was Intentionally Not Migrated

These features are intentionally not required in Zen:

- Firebase Auth
- Firestore
- Firebase Functions deployment
- teacher dashboard
- admin dashboard
- classroom workflows
- multi-user user management
- cloud image generation
- DigitalOcean provider
- Gemini provider
- OpenAI provider
- Judge0 remote execution
- cloud telemetry collection
- Firestore-backed rate limiter
- admin-only seeding functions

Reason: these contradict the offline-first, single-user, local-LLM personal edition target.

## Widget Edge-Case Coverage

### MCQ

Covered:

- `options` as array or object.
- aliases like `choices` and `answers`.
- duplicate option text.
- empty option text.
- answer text mapped back to option key.
- malformed or missing correct answer.
- hard cap of 8 options.

Fallback:

- If fewer than 2 options remain or the correct answer cannot be mapped, Zen returns `SPEAK`.

### MCQ reasoning

Covered:

- Same repair path as MCQ.
- Preserves `requiresReasoning`.
- Accepts reasoning prompt aliases.

Fallback:

- If base MCQ shape is invalid, Zen returns `SPEAK`.

### Flashcard

Covered by component migration and widget allowlist.

What-if:

- If a future model emits bad flashcard data, the component-level widget normalizer remains present and the tutor contract can be extended with an explicit flashcard sanitizer.

### Fill blank

Covered:

- `[BLANK]` markers.
- underscore blanks.
- `correctAnswers`, `answers`, or `answer`.
- comma-separated alternatives.
- casing differences.
- punctuation differences.
- article stripping through loose canonicalization.
- hard cap of 6 blanks.

Fallback:

- If no blanks or no answers exist, Zen returns `SPEAK`.

### Matching

Covered:

- `term/definition`
- `left/right`
- `prompt/match`
- duplicate pair removal.
- empty term/definition removal.
- hard cap of 8 pairs.

Fallback:

- If fewer than 2 valid pairs remain, Zen returns `SPEAK`.

### Timeline

Covered:

- string events.
- event objects with `label`, `event`, or `text`.
- `steps` alias.
- missing `correctOrder`.
- malformed `correctOrder`.
- hard cap of 7 events.

Fallback:

- If fewer than 2 events remain, Zen returns `SPEAK`.

### Diagram generator

Covered:

- node cap of 12.
- edge cap of 20.
- malformed or missing edge arrays.

Fallback:

- If fewer than 2 nodes exist, Zen returns `SPEAK`.

### Analogy

Covered:

- `correctAnswer`
- `answer`
- `acceptableAnswers`
- `answers`
- `options`
- comma-separated alternatives.
- whitespace and punctuation normalization available.

Fallback:

- If no correct answer can be determined, Zen returns `SPEAK`.

### Spaced review

Covered:

- `topics` and `queue` aliases.
- missing mastery defaults.
- stale timestamps tolerated.
- retention clamped between 0 and 100.
- hard cap of 10 topics.
- empty queues handled gracefully.

Fallback:

- Empty topic lists still render as an empty review state instead of crashing.

### Signal comparison

Status:

- Migrated and optional.
- Disabled automatically under high memory pressure.

### Tactical sandbox

Status:

- Migrated/reworked locally but disabled initially.

Reason:

- Old runtime depended on server or Judge0-style execution. Zen should stay offline and stable until a dedicated local executor is designed.

### Image analysis

Status:

- Migrated but disabled initially.

Reason:

- Local image analysis can be model-heavy and should not be part of the first low-resource release.

## LLM Failure What-If Analysis

### What if Ollama is not installed?

Expected behavior:

- Setup/runtime detection reports Ollama not running.
- Workspace remains usable in fallback/plain mode.
- Tutor API returns `SPEAK` fallback and a readable failure state.

Migration status:

- Covered by `listLocalModels`, `classifyModelFailure`, and API fallback.

### What if Ollama is installed but not running?

Expected behavior:

- Setup shows not running.
- No crash.
- User can recheck runtime after starting Ollama.

Migration status:

- Covered.

### What if selected model is missing?

Expected behavior:

- Setup shows model missing.
- Tutor call returns safe `SPEAK`.
- User can install/pull a smaller model.

Migration status:

- Covered by model listing and error classification.

### What if the model loads slowly?

Expected behavior:

- API waits only up to the configured timeout.
- On timeout, workspace receives `Inference timeout`.

Migration status:

- Covered by `AbortController` timeout.

### What if the model emits malformed JSON?

Expected behavior:

1. Try raw parse.
2. Try fenced JSON.
3. Try brace-depth object extraction.
4. Retry once with repair prompt.
5. Fall back to `SPEAK`.

Migration status:

- Covered.

### What if the model emits an unknown action?

Expected behavior:

- Normalize to `SPEAK`.

Migration status:

- Covered by `normalizeTutorResponse`.

### What if the model chooses a disabled widget?

Expected behavior:

- Normalize to `SPEAK`.
- Continue tutoring without rendering unsupported UI.

Migration status:

- Covered by widget policy and enabled widget check.

### What if the model emits an allowed widget with bad data?

Expected behavior:

- Sanitize if possible.
- If required data is missing, return `SPEAK`.

Migration status:

- Covered for MCQ, MCQ reasoning, fill blank, matching, timeline, diagram, analogy, and spaced review.

### What if VRAM is exhausted?

Expected behavior:

- Surface readable failure.
- Disable optional/heavy widgets when memory pressure is high.
- Preserve study state.

Migration status:

- Covered at the application-policy level by failure classification, memory pressure inference, and widget gating.

### What if context grows too large?

Expected behavior:

- Compact history before model calls.
- Summarize older turns.
- Keep recent interaction.

Migration status:

- Covered by `compactHistory` and session summary helpers.

### What if IndexedDB is blocked or corrupt?

Expected behavior:

- Fall back to localStorage/default state.
- Sanitize imported state.
- Avoid crash during hydration.

Migration status:

- Covered.

### What if backup import is malformed JSON?

Expected behavior:

- Import throws during parsing; UI should catch and show a readable error.

Migration status:

- Storage layer sanitizes valid JSON objects. UI-level import error handling should be checked before final deletion.

## Deletion Readiness

The following has been checked in source:

- `studypixel-zen/src` does not import legacy `studypixel`.
- `studypixel-zen/src` does not import legacy `functions`.
- Cloud provider names only appear in documentation or old folders, not in Zen runtime source.
- Widget component files are migrated.
- Offline tutor route uses local Ollama only.
- Local state does not require Firestore.

Before physically deleting `functions` and `studypixel`, run:

1. `npm run lint` from `studypixel-zen`.
2. `npm run dev` from `studypixel-zen`.
3. Open setup screen.
4. Confirm runtime detection works without local models installed.
5. Install/pull at least one small Ollama model.
6. Confirm a simple `SPEAK` tutor reply.
7. Confirm widgets render:
   - MCQ
   - MCQ reasoning
   - flashcard
   - fill blank
   - matching
   - timeline
   - analogy
   - spaced review
8. Confirm optional widgets disable when memory pressure is high.
9. Export a backup.
10. Import the backup.
11. Reset progress and verify recovery.

## Final Assessment

The necessary architectural behavior from `functions/index.js`, `functions/index.local.js`, `functions/providers/llmProvider.js`, `functions/widgetNormalizer.js`, and the old widget files has been migrated or intentionally replaced in Zen.

The old folders are not needed for Zen runtime once the final manual checks pass. The main remaining external setup item is local model installation through Ollama.
