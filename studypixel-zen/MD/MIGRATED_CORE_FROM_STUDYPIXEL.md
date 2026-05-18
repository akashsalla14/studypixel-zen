# Migrated Core From StudyPixel and Functions

This document tracks what was moved, copied, adapted, or intentionally left behind during the migration from the original StudyPixel project into StudyPixel Zen.

Zen is not a rewrite from nothing. It is a simplification and localization of the useful StudyPixel architecture.

## Migration Principle

Preserve:

- tutoring loop
- widget-driven learning
- defensive JSON handling
- widget normalization
- deterministic grading where possible
- mastery/review concepts
- local runtime recovery

Remove:

- Firebase-required runtime
- classroom workflows
- teacher/admin dashboards
- multi-user assumptions
- cloud model dependency
- remote code execution
- SaaS-style analytics

## Legacy Code Areas

| Legacy Area | Purpose | Zen Status |
| --- | --- | --- |
| `studypixel/src/app/page.js` | role/login entry and dashboards | replaced by single-user Zen launcher |
| `studypixel/src/components/pixelbot/PixelBotWorkspace.js` | old chat/widget workspace | concept preserved in Zen workspace |
| `studypixel/src/components/pixelbot/widgets` | widget components | migrated into Zen |
| `studypixel/src/lib/firebase.js` | Firebase app config | not migrated |
| `studypixel/src/lib/dataService.js` | Firestore-backed app data | replaced by local storage |
| `functions/index.js` | online cloud tutoring backend | replaced by local API route |
| `functions/index.local.js` | Ollama experiment | behavior migrated |
| `functions/providers/llmProvider.js` | provider abstraction | simplified into local Ollama client |
| `functions/widgetNormalizer.js` | widget metadata, canonicalization, telemetry | migrated and expanded |
| `functions/seedWidgets.js` | Firestore widget definitions | replaced by local widget policy |

## Migrated Widget Components

Copied into `src/widgets/components`:

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

Hash audit result:

- All migrated widget component hashes match the legacy widget files except `TacticalSandboxWidget.js`.
- `TacticalSandboxWidget.js` differs intentionally because the old version expected backend/cloud execution patterns that do not fit the first offline release.

## Migrated Backend Concepts

### Defensive JSON parsing

From:

- `functions/index.js`
- `functions/index.local.js`
- `functions/providers/llmProvider.js`

To:

- `src/tutor/contract.js`

Preserved strategies:

- parse raw JSON
- extract fenced JSON
- extract top-level object using brace-depth scanning
- fall back safely

Zen addition:

- one local repair prompt before final fallback to `SPEAK`

### LLM behavior contract

From:

- old teaching output validation
- provider response normalization

To:

- `src/tutor/contract.js`
- `src/app/api/tutor/route.js`

Final contract:

```json
{ "action": "SPEAK", "mentor_speech": "..." }
```

or:

```json
{ "action": "USE_WIDGET", "widgetId": "mcq-v1", "widgetData": {} }
```

Unknown or invalid output becomes `SPEAK`.

### Sequential local inference

From:

- `functions/index.local.js`

To:

- `src/app/api/tutor/route.js`

Preserved rule:

- one active model request chain at a time

Reason:

- RTX 2050 / 4 GB VRAM / 8 GB RAM is not suitable for local fanout or multi-model councils.

### Model health and failure classification

From:

- local function experiment
- provider fallback behavior

To:

- `src/model/ollamaClient.js`
- `src/ui/runtimeState.js`

Covered states:

- Ollama not running
- Model Missing
- Inference timeout
- Context overflow
- VRAM exhaustion
- Error

### Widget policy

From:

- Firestore widget seed definitions
- old widget specifications

To:

- `src/widgets/widgetPolicy.js`

Required first-release widgets:

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

### Widget normalization

From:

- `functions/widgetNormalizer.js`
- `studypixel/src/components/pixelbot/widgets/widgetNormalizer.js`

To:

- `src/normalization/widgetNormalization.js`
- `src/tutor/contract.js`
- `src/widgets/components/widgetNormalizer.js`

Preserved:

- base metadata normalization
- answer canonicalization
- telemetry structure

Expanded:

- alias handling
- duplicate removal
- hard caps for low-resource stability
- schema drift repair
- disabled-widget fallback

### Telemetry

From:

- function telemetry capture
- widget telemetry payloads

To:

- `src/telemetry/buildTelemetry.js`
- `src/storage/zenStorage.js`
- `src/components/ZenApp.js`

Changed:

- telemetry is local only
- no Firestore collection writes
- no cloud analytics

### Mastery and review

From:

- cloud BKT update logic
- adaptive profile documents
- spaced review data

To:

- local mastery state
- local review queue
- widget submissions
- session summaries

Intentional simplification:

- Zen uses local heuristics for the first offline release instead of the full Firestore-backed adaptive profile pipeline.

## What Was Not Migrated

Not migrated because it conflicts with Zen's personal offline target:

- Firebase Auth login wall
- Firestore runtime dependency
- Firebase Functions deployment
- admin user creation
- password reset
- teacher dashboard
- classroom dashboard
- organization/team model
- cloud model provider fallback
- DigitalOcean inference
- Gemini inference
- OpenAI inference
- Judge0 remote execution
- Firestore rate limits
- cloud widget seeding

## Where Things Live Now

| Responsibility | Zen File |
| --- | --- |
| app entry | `src/app/page.js` |
| local tutor API | `src/app/api/tutor/route.js` |
| Ollama client | `src/model/ollamaClient.js` |
| tutor output contract | `src/tutor/contract.js` |
| widget policy | `src/widgets/widgetPolicy.js` |
| widget components | `src/widgets/components` |
| normalization helpers | `src/normalization/widgetNormalization.js` |
| telemetry builder | `src/telemetry/buildTelemetry.js` |
| local persistence | `src/storage/zenStorage.js` |
| session compaction | `src/session/sessionManager.js` |
| runtime state labels | `src/ui/runtimeState.js` |
| main UI | `src/components/ZenApp.js` |

## Migration Verification

Checked:

- Zen source does not import old `studypixel`.
- Zen source does not import old `functions`.
- Zen production build succeeds.
- Widget components are present in Zen.
- Local Ollama path is self-contained.
- Local storage path is self-contained.
- Cloud/admin/classroom code is not part of ordinary Zen runtime.

Known verification gap:

- lint cannot start until ESLint 9 flat config is added.
- full model behavior requires Ollama plus at least one pulled model.

## Final Migration Position

After final manual runtime testing, Zen should be able to survive deletion of:

- `studypixel`
- `functions`

The old folders should be kept only as archival reference until the manual deletion checklist passes.
