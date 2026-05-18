# StudyPixel Zen

StudyPixel Zen is the offline-first, single-user edition of StudyPixel.

It keeps the strongest parts of the existing system:

- conversational tutoring
- adaptive widget learning
- defensive JSON parsing
- mastery tracking
- session continuity
- review workflows

It removes the classroom and cloud-first assumptions:

- no login wall for normal use
- no teacher or admin dashboards
- no Firestore dependency for day-to-day study
- no cloud inference dependency during normal usage

## Runtime shape

```text
Next.js frontend -> local tutoring API -> Ollama localhost -> local persistence
```

This folder is now designed to be self-contained so legacy `studypixel` and `functions` folders can be removed after verification.

## Primary flow

```text
Launch -> Runtime Detection -> Setup Profile -> Study Hub -> Study Workspace -> Tutor Loop
```

No cloud auth, classroom dashboard, or Firestore runtime dependency is required for normal study.

## Runtime states

- Starting
- Ready
- Model Missing
- Offline Fallback
- Error
- Recovering

The UI exposes these in Setup and the diagnostics strip.

## Low-resource policy

- single active model
- sequential request chain only
- compact prompts and compact JSON
- local fallback to SPEAK when model output is malformed
- automatic context trimming and session summarization
- optional heavy widgets disabled under high memory pressure

Recommended starter models:

- qwen2.5:0.5b
- llama3.2:1b
- phi3:mini
- phi3.5:mini

## Widget policy

Required offline widgets:

- mcq-v1
- mcq-reasoning-v1
- flashcard-v1
- fill-blank-v1
- matching-v1
- timeline-v1
- analogy-v1
- spaced-review-v1

Optional widgets (memory-gated):

- diagram-generator-v1
- signal-comparison-v1

Disabled initially:

- tactical-sandbox-v1
- image-analysis-v1

Enabled widgets in this release:

- mcq-v1
- mcq-reasoning-v1
- flashcard-v1
- fill-blank-v1
- matching-v1
- timeline-v1
- analogy-v1
- spaced-review-v1
- diagram-generator-v1
- signal-comparison-v1

## What this folder contains

- `src/app/page.js` - the Zen launcher and workspace shell
- `src/app/api/tutor/route.js` - local tutoring API with Ollama fallback logic
- `src/components/ZenApp.js` - setup, hub, workspace, diagnostics, settings, and review queue
- `src/components/externalWidgets.js` - adapters for Zen-local widget components
- `src/model/ollamaClient.js` - local model health, chat calls, and failure classification
- `src/storage/zenStorage.js` - IndexedDB-first persistence, backup import/export, reset, migration-safe sanitization
- `src/session/sessionManager.js` - context compaction, summarization, and memory-pressure helpers
- `src/tutor/contract.js` - strict output contract, JSON recovery, widget payload sanitization
- `src/widgets/widgetPolicy.js` - required/optional widget whitelists and memory-aware enablement
- `src/widgets/components` - migrated widget components now owned by Zen
- `src/ui/runtimeState.js` - runtime status derivation for setup diagnostics
- `src/lib/localStore.js` and `src/lib/tutor.js` - compatibility layers for existing imports

## MD docs

- `MD/INSTALLATION_FOR_EVERYONE.md` - beginner-friendly install and first-run guide
- `MD/SETUP_WIZARD_GUIDE.md` - setup states, model selection, and seed pack usage
- `MD/ARCHITECTURE_AND_RUNTIME.md` - Zen architecture, runtime boundaries, and source map
- `MD/LOCAL_LLM_OPERATIONS.md` - Ollama, model selection, sequential inference, and failure states
- `MD/WIDGET_CONTRACT_AND_EDGE_CASES.md` - widget allowlist, schemas, normalization, and fallbacks
- `MD/DATA_STORAGE_AND_BACKUP.md` - IndexedDB/localStorage persistence and backup recovery
- `MD/RESEARCHER_WORKFLOW.md` - reproducible local research usage pattern
- `MD/TROUBLESHOOTING.md` - practical issue resolution
- `MD/MIGRATED_CORE_FROM_STUDYPIXEL.md` - migration map of code and architecture moved into zen
- `MD/MIGRATION_WHAT_IF_EDGE_CASE_ANALYSIS.md` - detailed migration edge-case audit
- `MD/DELETE_READINESS_CHECKLIST.md` - pre/post-delete safety checklist

## Notes

The app is intentionally compact for low-resource laptops. It uses a single active model, sequential calls only, and falls back to SPEAK when the model response is malformed or unavailable.
