# Architecture And Runtime

StudyPixel Zen is the offline-first personal edition of StudyPixel. It keeps the tutor and widget architecture, but removes classroom, cloud, and multi-user assumptions.

## Primary Architecture

```text
Next.js app
  -> browser UI
  -> local API route
  -> Ollama on localhost
  -> local browser persistence
```

There is no required Firebase, Firestore, Firebase Functions, cloud auth, or external model API in ordinary runtime.

## Design Target

Zen should feel like:

- a private AI study desk
- a local adaptive tutor
- a compact personal learning environment

Zen should not feel like:

- a school SaaS dashboard
- a teacher/admin panel
- a classroom LMS
- a cloud analytics product

## Hardware Target

Primary target:

- NVIDIA RTX 2050
- 4 GB VRAM
- around 8 GB system RAM
- limited thermal headroom
- single active user

Architectural consequences:

- no parallel LLM fanout
- no multi-model council in normal runtime
- no heavy background jobs
- no vector DB by default
- no large prompts
- no large JSON payloads
- one model request chain at a time
- optional widgets disabled under pressure

## Source Map

| Area | File |
| --- | --- |
| app entry | `src/app/page.js` |
| layout metadata | `src/app/layout.js` |
| main UI shell | `src/components/ZenApp.js` |
| widget adapter/registry | `src/components/externalWidgets.js` |
| local API route | `src/app/api/tutor/route.js` |
| Ollama client | `src/model/ollamaClient.js` |
| tutor contract | `src/tutor/contract.js` |
| widget policy | `src/widgets/widgetPolicy.js` |
| widget components | `src/widgets/components` |
| normalization helpers | `src/normalization/widgetNormalization.js` |
| telemetry builder | `src/telemetry/buildTelemetry.js` |
| persistence | `src/storage/zenStorage.js` |
| session management | `src/session/sessionManager.js` |
| runtime status | `src/ui/runtimeState.js` |
| compatibility local store | `src/lib/localStore.js` |
| compatibility tutor helpers | `src/lib/tutor.js` |

## Application Flow

```text
Launch
  -> hydrate local state
  -> detect local runtime
  -> setup or resume profile
  -> Study Hub
  -> Study Workspace
  -> Tutor loop
```

There is no role selection.

There is no login gate.

There is no teacher/admin branch.

## Runtime Detection

Runtime detection checks Ollama, not the internet.

Flow:

```text
Setup UI
  -> /api/tutor health request
  -> listLocalModels()
  -> GET http://localhost:11434/api/tags
  -> derive readable runtime state
```

Runtime state examples:

- Starting
- Ready
- Model Missing
- Loading Model
- Offline Fallback
- Error
- Recovering

## Tutor Request Flow

Normal tutor call:

```text
User message
  -> compact local history
  -> infer enabled widgets
  -> build compact tutor prompt
  -> enqueue local Ollama call
  -> parse JSON
  -> repair once if malformed
  -> normalize response
  -> render SPEAK or widget
  -> persist local state
```

Important:

- `src/app/api/tutor/route.js` uses a module-level queue.
- This prevents local model fanout.
- The queue is deliberately simple because Zen is single-user.

## Response Contract

The tutor backend accepts only two shapes.

Plain tutor speech:

```json
{
  "action": "SPEAK",
  "mentor_speech": "..."
}
```

Widget use:

```json
{
  "action": "USE_WIDGET",
  "widgetId": "mcq-v1",
  "widgetData": {}
}
```

Unknown actions become `SPEAK`.

Disabled widgets become `SPEAK`.

Malformed widget payloads become `SPEAK`.

## Defensive JSON Handling

The model may emit:

- valid JSON
- JSON in markdown fences
- JSON surrounded by explanation text
- malformed JSON
- no JSON

Zen response recovery:

1. Parse raw JSON.
2. Extract fenced JSON.
3. Extract top-level object by brace-depth scanning.
4. Ask the model once to repair the output.
5. Fall back to `SPEAK`.

This is the core safety mechanism that prevents the workspace from crashing on bad model output.

## Widget Runtime

Widget policy is local:

- required widgets are always eligible
- optional widgets are memory-gated
- disabled widgets are not eligible

The tutor prompt lists enabled widgets so the model has a compact, current tool list.

Widget payloads are sanitized before rendering. Each sanitizer tries to repair common schema drift, then rejects incomplete data.

## Storage Runtime

Persistence strategy:

```text
IndexedDB primary
  -> localStorage snapshot fallback
  -> backup JSON export/import
```

Stored data:

- profile
- settings
- sessions
- session archive
- review queue
- mastery
- history
- summaries
- widget submissions

State is sanitized on load and import.

## Memory Management

Memory pressure is handled through:

- compact history for API calls
- session summaries
- archived sessions
- optional widget gating
- small model preference
- request timeouts

Zen should reduce complexity before crashing.

## Error Recovery

The user should never be stranded.

Every major failure path should preserve:

- profile
- current topic
- recent messages
- local backup option
- readable status
- plain text fallback

No workspace path should expose raw stack traces as the main user-facing experience.

## Cloud Boundary

Zen ordinary runtime must not call:

- Firebase Auth
- Firestore
- Firebase Functions
- DigitalOcean
- Gemini
- OpenAI
- Judge0

If future optional cloud features are added, they must be clearly isolated and disabled by default.

## Acceptance Criteria

Architecture is acceptable when:

- app builds from `studypixel-zen`
- old folders can be renamed without breaking runtime
- setup works without internet
- Ollama detection works locally
- tutor call uses localhost only
- local storage survives refresh
- malformed LLM output falls back safely
- core widgets render or fail safely
- optional heavy widgets can be disabled
