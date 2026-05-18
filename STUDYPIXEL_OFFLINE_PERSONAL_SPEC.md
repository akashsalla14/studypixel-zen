# StudyPixel Offline Personal Version Spec

This document is the implementation brief for a **single-user, offline-first StudyPixel clone** intended for a personal computer with limited resources. It is grounded in the current repo structure and should be used as the source of truth when asking Copilot to build the offline version.

## 1. Goal

Build a personal StudyPixel edition that:

- Runs without internet after models and dependencies are installed.
- Removes teacher, class, student, and admin workflows.
- Uses one local learner account only.
- Uses a local LLM loop for tutoring, feedback, and widget selection.
- Stays stable on low resource hardware by avoiding parallel model calls and heavy background services.

This is not a classroom system, not a hosted multi-user server, and not a production cloud deployment.

## 2. Target Device Constraints

Use the user's real hardware limits as the design budget:

- GPU: NVIDIA GeForce RTX 2050
- VRAM: 4 GB
- System RAM: about 8 GB total, with heavy real-world memory pressure already present
- Power cap: 30 W
- Use case: one active learner at a time

Design implication:

- One model instance should be reused sequentially.
- No parallel evaluator fan-out.
- Short context windows only.
- Small output limits.
- Avoid image generation and code execution by default.

## 3. Ground Truth From the Repo

The current codebase already has partial local support, but it is split across cloud and local paths.

### Frontend

- The Next.js app is in [studypixel/package.json](studypixel/package.json).
- It uses Next.js 16.1.6, React 19.2.3, Firebase 12.9.0, and Recharts.
- The app is configured for static export in [studypixel/next.config.js](studypixel/next.config.js).
- The student tutoring UI lives in [studypixel/src/components/pixelbot/PixelBotWorkspace.js](studypixel/src/components/pixelbot/PixelBotWorkspace.js).
- The Firebase client setup is in [studypixel/src/lib/firebase.js](studypixel/src/lib/firebase.js).
- Data persistence helpers are in [studypixel/src/lib/dataService.js](studypixel/src/lib/dataService.js).

### Backend

- Firebase Functions live under [functions/index.js](functions/index.js).
- The main production backend still uses cloud inference through direct DigitalOcean calls in [functions/index.js](functions/index.js).
- A separate local backend exists in [functions/index.local.js](functions/index.local.js).
- A provider abstraction exists in [functions/providers/llmProvider.js](functions/providers/llmProvider.js), but the main backend does not yet depend on it.
- Local model configuration is in [functions/config/models.local.js](functions/config/models.local.js).
- Widget definitions are seeded from [functions/seedWidgets.js](functions/seedWidgets.js).

### Current docs

- Existing local LLM guidance is in [LOCAL_LLM_SETUP.md](LOCAL_LLM_SETUP.md).
- The local backend setup guide is in [functions/README.local.md](functions/README.local.md).
- Widget behavior is documented in [WIDGET_SPECIFICATIONS.md](WIDGET_SPECIFICATIONS.md).

## 4. Current Architecture Reality

The repo already contains many of the concepts needed for a local build, but the local path is not yet the default path.

### What already exists

- A local Ollama inference path in [functions/index.local.js](functions/index.local.js).
- Hardware-aware local model defaults in [functions/config/models.local.js](functions/config/models.local.js).
- Sequential evaluator behavior is already intended for low VRAM setups.
- Robust JSON parsing and fallback logic already exist in the backend.
- Widget schemas and UI components already exist for several learning interactions.

### What is still cloud-first

- The main backend entry point [functions/index.js](functions/index.js) still sends requests to cloud inference directly.
- The provider abstraction is present but not yet wired into the production function flow.
- The frontend Firebase client in [studypixel/src/lib/firebase.js](studypixel/src/lib/firebase.js) does not currently connect to emulators.
- [firebase.json](firebase.json) points to the functions folder, but the deployed function entry still resolves through [functions/package.json](functions/package.json) to `index.js`.
- The frontend is still built around Firebase Auth and Firestore persistence.

### Backend control flow in `index.js`

The current production backend is not a thin router. It is a full multi-stage tutoring pipeline:

1. Intent classification decides whether the learner is answering, chatting, or asking for help.
2. The assessment council evaluates answers and can run multiple model calls.
3. The teaching agent chooses whether to speak or show a widget.
4. The validator repairs or normalizes malformed LLM output.
5. BKT updates are written back into Firestore after each turn.
6. Widget data is fetched from Firestore and injected into the prompt.
7. Sandbox code execution and image generation are handled by separate cloud services.

That means the offline build is not just a model swap. It must simplify the whole loop so the tutoring flow can survive on one machine without the cloud dependencies.

### Specific `index.js` behaviors that matter offline

- `sendToDigitalOcean` is the default inference path for the router, evaluators, and instructor.
- Image generation uses a separate DigitalOcean image endpoint.
- Sandbox execution uses Judge0 through RapidAPI when available.
- `evaluateWithCouncil` reads Firestore widget definitions and adaptive profile data.
- `generatePixelBotPrompt`, `createUser`, `updateUser`, `resetPassword`, and `deleteUser` all assume cloud auth and cloud admin workflows.
- `updateStudentProfile` expects a Firestore-backed message history and profile document.

For the personal offline version, only the tutoring loop, widget rendering, and lightweight progress tracking should remain.

### What the local provider abstraction still does not solve by itself

`functions/providers/llmProvider.js` is useful, but it is only one part of the migration. The offline build also needs:

- local persistence instead of Firestore for day-to-day use,
- local widget catalogs instead of Firestore widget reads,
- local or disabled sandbox behavior,
- local or disabled image generation,
- and a simplified frontend that no longer requires login.

In other words, the provider abstraction makes inference swappable, but it does not make the whole app offline.

## 5. Offline Personal Scope

The offline personal version should keep only the parts a single learner needs.

### Keep

- PixelBot conversational tutoring.
- Adaptive mastery logic.
- Widget-driven learning.
- Chat history.
- Progress tracking.
- Lesson topics, hints, summaries, and review.
- Local logs for debugging and learning review.

### Remove or disable

- Teacher dashboard.
- Admin dashboard.
- Multi-class management.
- User roles and teacher/student account flows.
- Cloud-based auth.
- Cloud Firestore dependency for day-to-day use.
- Cloud image generation.
- External code execution services unless explicitly reintroduced later.
- Multi-user concurrency.

### Replace

- Firebase Auth -> local single-user profile or local app settings.
- Firestore -> local persistence such as IndexedDB, local JSON files, or SQLite.
- Cloud LLM APIs -> Ollama on localhost.
- Judge0/RapidAPI -> disabled by default or replaced with static analysis only.
- Teacher/student metrics -> personal progress dashboard.

## 6. Recommended Offline Architecture

Use a local-first architecture that keeps the app simple and stable on the target machine.

```text
Next.js frontend
    -> local tutoring API or local server functions
    -> Ollama on localhost:11434
    -> local persistence
```

### Recommended runtime shape

- Frontend: Next.js in local dev or local desktop-style launch.
- Backend: one local Node server or local Next API layer that talks to Ollama.
- Storage: local-only persistence.
- LLM: Ollama.
- Widgets: keep the current widget system but simplify the schemas and defaults for low-resource use.

### Why not rely on the current static export

[studypixel/next.config.js](studypixel/next.config.js) uses `output: 'export'`, which is fine for static hosting but awkward for a local inference app that needs a live backend bridge. The offline build should either:

- switch to a local server mode, or
- add a separate local API host that the static frontend can call.

For a personal offline build, a local server mode is the cleaner option.

### Recommended technical shape for the personal offline build

The safest implementation path is:

- Next.js frontend running locally.
- A single local inference target: Ollama on `localhost:11434`.
- Local-only persistence for chat history, preferences, and progress.
- No Firebase Auth gate in the offline path.
- No Firestore dependency for everyday runtime.
- Optional Firebase-emulator compatibility only if you want a transitional dev mode, not as the final offline storage layer.

This keeps the stack close to the current app while removing the cloud coupling that would fail offline.

## 7. Local LLM Strategy For This Hardware

The RTX 2050 with 4 GB VRAM and tight RAM headroom should run a conservative model profile.

### Safe strategy

- Use one small model for all roles if possible.
- Run Router, Evaluators, and Instructor sequentially.
- Keep prompts short.
- Keep outputs compact and strongly structured.
- Prefer reliable JSON over creative natural language.
- Use repair prompts when the model returns malformed JSON.

### Suggested model tier

Use a profile below the repo's current budget assumptions. The existing `tier-1-budget` config in [functions/config/models.local.js](functions/config/models.local.js) is already directionally correct, but it is still too ambitious for a machine with only 4 GB VRAM and little free RAM.

Recommended personal profile characteristics:

- Router: 1B to 2B class model.
- Evaluators: same model as router, reused sequentially.
- Instructor: same model, or one slightly larger small model only if memory allows.
- Context: last 4 to 6 turns, not 10 to 20.
- Evaluator max tokens: 128 to 192.
- Instructor max tokens: 384 to 768.
- No parallel evaluators.

### Practical model guidance

Prefer these kinds of choices:

- `gemma2:2b`
- `qwen2.5:0.5b` or another CPU-friendly tiny router if needed
- `phi3.5:mini` only if the system stays stable

If the machine begins swapping, shrink the model first, not the prompt logic.

## 8. Offline App Behavior

The offline personal version should behave like this:

1. User opens the app locally.
2. The app loads a single personal profile and local history.
3. The user chats with PixelBot.
4. The local backend sends a short prompt to Ollama.
5. The model returns either `SPEAK` or `USE_WIDGET`.
6. The UI renders a widget or a plain response.
7. Local progress is saved to local storage.

## 8.1 Offline UI/UX Model

The current app shell in `studypixel/src/app/page.js` is role-based: login screen, then admin/teacher/student dashboards, then the PixelBot workspace. That shape is not right for a personal offline build.

### What the personal offline UX should look like

- No login wall on first launch.
- No teacher/student/admin routing.
- One home screen with a clear `Start Learning` or `Resume Session` action.
- One persistent personal profile instead of multiple users.
- One workspace that opens directly into the tutor loop.
- A settings panel for local model selection, context length, storage export/import, and reset progress.

### Personal wireframe

The offline personal version should be designed as a three-stage flow, not a dashboard maze:

```text
1. Launch / Setup
    - Detect Ollama
    - Pick local model
    - Create or resume personal profile

2. Home / Study Hub
    - One prominent current goal card
    - Resume Session button
    - Review Due queue
    - Settings and Export buttons

3. Study Workspace
    - Left: mentor chat
    - Center/Right: widget or explanation canvas
    - Bottom: compact diagnostics strip
```

### Home screen content

The home screen should answer three questions immediately:

- What should I study now?
- Is the local tutor ready?
- How do I continue my last session?

Recommended home cards:

- `Continue Learning`: opens the last active topic and scrolls to the latest message.
- `Review Due`: shows topics that need spaced repetition.
- `Fresh Topic`: starts a new topic or subject area.
- `Session Health`: shows local model status, storage status, and memory pressure.
- `Settings`: opens model, storage, and export controls.

### Study workspace wireframe

The current `PixelBotWorkspace` is already close to the right shape, but the offline version should simplify it:

```text
┌──────────────────────────────────────────────────────────────┐
│ Header: topic, model status, session actions, export, reset  │
├──────────────────────────────────────────────────────────────┤
│ Left pane: chat history + input                              │
│ Right pane: widget canvas or plain explanation               │
├──────────────────────────────────────────────────────────────┤
│ Bottom strip: progress, recent feedback, logs, offline state │
└──────────────────────────────────────────────────────────────┘
```

### Interaction rules in the workspace

- The user types a question or answer in the chat box.
- The app immediately echoes the user message locally.
- The local tutor response appears when the model returns.
- If the response is `SPEAK`, the right pane stays empty or shows a small explanation card.
- If the response is `USE_WIDGET`, the right pane becomes the active learning surface.
- When a widget is submitted, the chat log records the answer and the system updates the local mastery state.
- If the user changes topics, the workspace should preserve the last topic’s history but visually separate sessions.

### UX treatment for the offline personal user

The offline version should feel calm, focused, and private. It should not feel like a school admin system.

- Use one accent color and a restrained background instead of dense dashboards.
- Use a compact, readable layout optimized for long study sessions.
- Keep the main action path obvious: `Ask`, `Answer`, `Review`, `Continue`.
- Avoid role language entirely.
- Avoid terminology like teacher assignment, class roster, or admin control.
- Use plain language such as `Session`, `Topic`, `Review Due`, `Local Tutor`, and `Export Backup`.

### Visual hierarchy priorities

1. Current question or next action.
2. Tutor response or widget.
3. Session progress and mastery.
4. Model status and offline health.
5. Settings and advanced controls.

### Theme direction

The current CSS uses a dark glassmorphism style and an Apple-like login card. For the offline personal build, keep the polished feel but reduce visual noise:

- Keep the dark learning canvas.
- Reduce the number of cards and panels.
- Make the chat box and widget area the dominant surfaces.
- Use a compact top bar instead of a heavy dashboard header.
- Keep log output optional and collapsible so it does not crowd the study flow.

### Responsive behavior

- Desktop: two-column workspace with a bottom status strip.
- Tablet: stack chat above canvas, keep status strip collapsed by default.
- Narrow screens: single-column mode with chat first and widgets below.
- Very low resolution: collapse logs and hide secondary panels until opened.

### Offline setup and recovery states in the UI

The UI should expose these states explicitly:

- `Starting`: app is checking local storage and loading the model.
- `Ready`: local tutor is reachable.
- `Loading model`: Ollama is present but the selected model is still coming online.
- `Model missing`: the selected model has not been pulled yet.
- `Offline fallback`: the app is still usable, but only with local static help or cached content.
- `Saving`: local progress is being written.
- `Recovered`: the previous session was restored successfully.

Those states are important because offline users need trust signals, not silent failures.

### Interaction loop for a personal learner

1. Open app.
2. Continue the last topic or choose a new one.
3. Read a prompt or question.
4. Answer in chat or interact with a widget.
5. Receive a short explanation or correction.
6. Review current mastery and decide whether to continue.
7. Save and optionally export the session.

### Recommended layout for the personal workspace

The existing workspace CSS shows a three-part shell: chat, canvas, and logs. For the offline personal build, keep the same mental model but simplify it:

- Left pane: mentor chat and input.
- Right pane: widget canvas or explanation canvas.
- Bottom drawer or collapsible strip: diagnostics, model status, and recent actions.

### UX rules for low-resource hardware

- Prefer one-column stacking on narrow windows.
- Keep controls large and obvious; avoid cluttered dashboard widgets.
- Show an explicit Ollama status badge: `Ready`, `Loading`, `Model missing`, or `Offline fallback`.
- Show a lightweight progress badge for current topic and mastery.
- Offer a fast `Reset Session` action because local state may drift during testing.
- Keep the error language plain and actionable instead of surfacing raw backend exceptions.

### Offline-first onboarding flow

The first run should do only a few things:

1. Detect whether Ollama is reachable.
2. Let the user choose or confirm a local model.
3. Create the single local profile.
4. Load or seed the initial learning topics.
5. Open the workspace.

That is enough for a personal tutor. Anything more belongs in later iterations.

## 9. What To Change In The Codebase

These are the main implementation surfaces Copilot should modify.

### Backend inference

- Wire [functions/providers/llmProvider.js](functions/providers/llmProvider.js) into the main backend flow.
- Stop calling cloud inference directly from [functions/index.js](functions/index.js).
- Make `LLM_MODE=local` actually control the active provider path.
- Keep `index.local.js` only as a reference or temporary fallback, not a second source of truth.

### Frontend Firebase wiring

- Update [studypixel/src/lib/firebase.js](studypixel/src/lib/firebase.js) to connect to local emulators when requested.
- Add emulator support for Auth, Firestore, and Functions.
- Add a safe offline fallback if Firebase config is missing.

### Data persistence

- Replace cloud persistence assumptions in [studypixel/src/lib/dataService.js](studypixel/src/lib/dataService.js) with local persistence for the offline build.
- Store chat history, progress, and profile data locally.
- Keep the API shape similar so the UI changes stay small.

### Chat flow

- Reduce history sent from [studypixel/src/components/pixelbot/PixelBotWorkspace.js](studypixel/src/components/pixelbot/PixelBotWorkspace.js) from the last 10 messages to 4 to 6 messages.
- Avoid sending large history objects to the model.
- Keep widget submission parsing strict and compact.

### Widget loading

- Keep widget rendering components.
- Prefer simpler widget schemas when the model is weak or context is long.
- Keep `SPEAK` as the safe fallback when widget JSON is invalid.

### Workspace behavior on long sessions

The offline tutor should manage study fatigue and memory growth gracefully:

- Archive older turns into a collapsed session summary.
- Keep the last few turns expanded and visible.
- Offer a `Summarize Session` action after a long run.
- Provide a `New Session` button that preserves exportable history.
- If the chat becomes too long, summarize before asking the model again.

### Offline progress model in the UI

The personal build should make progress visible without exposing a full classroom analytics panel:

- Current topic mastery bar.
- Review urgency indicator.
- Recent streak or study time today.
- Small badge for the last successful widget type.
- Optional session notes.

This replaces the current student/teacher analytics-heavy design with something more personal and actionable.

### Local model config

- Add a dedicated ultra-low-resource profile in [functions/config/models.local.js](functions/config/models.local.js).
- Use a single-model sequential setup for the personal offline build.

### Seeding

- Keep the widget seed data in [functions/seedWidgets.js](functions/seedWidgets.js).
- Seed only the widgets the offline version actually uses.

## 10. Features That Should Stay In The Offline Clone

These are the most valuable learning features to keep:

- Conversational tutoring.
- Correct answer checking.
- Hint generation.
- Simple adaptive review.
- MCQ widgets.
- Flashcards.
- Fill-in-the-blank.
- Matching.
- Timeline ordering.
- Diagram generation through text-based widget data, not image generation.
- Personal mastery tracking.

## 10.1 Widget-By-Widget Offline Analysis

The widget files in `studypixel/src/components/pixelbot/widgets/` already tell us how much of the app is feasible offline and how much needs to be reduced.

### Safe to keep for the first offline release

These widgets are local-UI heavy, deterministic, and do not require external services beyond the tutoring backend:

- [MCQBaseWidget.js](studypixel/src/components/pixelbot/widgets/MCQBaseWidget.js) and [MCQWidget.js](studypixel/src/components/pixelbot/widgets/MCQWidget.js): simplest objective assessment path. Good for low-resource mode.
- [MCQReasoningWidget.js](studypixel/src/components/pixelbot/widgets/MCQReasoningWidget.js): still local-only, but the reasoning text makes prompts larger, so keep it short.
- [FlashcardWidget.js](studypixel/src/components/pixelbot/widgets/FlashcardWidget.js): very good offline fit. The telemetry is local and the card flip interaction is cheap.
- [FillBlankWidget.js](studypixel/src/components/pixelbot/widgets/FillBlankWidget.js): strong offline fit. It is deterministic and its canonicalization logic is useful for low-resource tutoring.
- [MatchingWidget.js](studypixel/src/components/pixelbot/widgets/MatchingWidget.js): offline-friendly and pedagogically strong. It already normalizes pair structures and does all validation in the browser.
- [TimelineWidget.js](studypixel/src/components/pixelbot/widgets/TimelineWidget.js): offline-friendly but should be capped to a small number of items because it tracks drag state and interaction traces.
- [AnalogyWidget.js](studypixel/src/components/pixelbot/widgets/AnalogyWidget.js): local-only and lightweight, but keep prompts concise because free-text answers can grow quickly.
- [SpacedReviewWidget.js](studypixel/src/components/pixelbot/widgets/SpacedReviewWidget.js): very important for the personal version because it links directly to BKT-style review without external execution.

### Keep, but simplify aggressively

These widgets work locally, but they are more expensive or more fragile than the basic assessment widgets:

- [DiagramGeneratorWidget.js](studypixel/src/components/pixelbot/widgets/DiagramGeneratorWidget.js): good offline substitute for image generation, but the graph layout logic is relatively heavy. Keep the widget, but cap node count and prefer simple diagrams.
- [SignalComparisonWidget.js](studypixel/src/components/pixelbot/widgets/SignalComparisonWidget.js): useful for debugging and reasoning, but free-text reasoning makes the prompt longer and more model-sensitive.
- [widgetNormalizer.js](studypixel/src/components/pixelbot/widgets/widgetNormalizer.js): keep this file. It is one of the most valuable pieces for offline robustness because it absorbs schema drift and standardizes telemetry.

### Remove from the first offline release

These are the main blockers for a truly self-contained personal build:

- [TacticalSandboxWidget.js](studypixel/src/components/pixelbot/widgets/TacticalSandboxWidget.js): this widget depends on Firebase Functions callables and backend code execution endpoints. It also assumes `runSandboxCode`, `submitSandboxSolution`, and `getSandboxAttempts` exist server-side. That makes it unsuitable for the first offline release unless it is downgraded to a local static-analysis-only mode.
- [ImageAnalysisWidget.js](studypixel/src/components/pixelbot/widgets/ImageAnalysisWidget.js): the widget itself is local UI, but its usefulness depends on having images to analyze. In a fully offline personal build, this should be kept only if the images are local files or embedded assets. Otherwise, remove or disable it.

### Why the widget architecture is still useful offline

The widget system is already a good fit for a personal offline tutor because each widget:

- accepts a compact JSON payload,
- uses local validation and browser state,
- emits structured telemetry,
- and can fall back to simple review or correction without requiring a round-trip to a separate UI system.

That means the offline build should preserve the widget architecture, but narrow the supported widget set.

### Recommended offline widget whitelist

For the first personal build, the safe whitelist should be:

- `mcq-v1`
- `mcq-reasoning-v1`
- `flashcard-v1`
- `fill-blank-v1`
- `matching-v1`
- `timeline-v1`
- `analogy-v1`
- `spaced-review-v1`
- `diagram-generator-v1` only if diagrams are kept text-based and compact

Everything else should be considered optional or future work.

### Why the current widget code is defensive

The widget components are not just UI. They are the first line of defense against malformed LLM output and inconsistent schemas.

- `normalizeBaseData` exists because models often rename or omit common fields like `prompt`, `hint`, `explanation`, or `studentAnswer`.
- `canonicalize` exists because students should not be marked wrong for casing, punctuation, or spacing differences.
- `buildTelemetry` exists because the backend uses hesitation, response time, and interaction traces to infer confidence.
- Local validation in the widget is important because it lets the user receive immediate feedback without a network call.

For the offline personal build, these defensive behaviors should remain, but the telemetry can be simplified and stored locally instead of being streamed to Firestore.

### Widget edge-case map: current behavior and offline translation

- `mcq-v1` and `mcq-reasoning-v1`:
    - Current code normalizes object or array options and supports reasoning text.
    - Edge cases include missing options, wrong answer keys, or reasoning that is too short.
    - Offline version should keep the same normalization and fallback to a regeneration request if no options are present.

- `flashcard-v1`:
    - Current code treats the card as a self-assessment widget and uses flip timing as a confidence proxy.
    - Edge cases include missing front/back text, repeated flips, and overly long answer text.
    - Offline version should keep the card flip UI, but store only compact local metrics and avoid overfitting mastery to a single flip.

- `fill-blank-v1`:
    - Current code handles `[BLANK]` markers and underscore hallucinations.
    - It canonicalizes answers and strips articles like `a`, `an`, and `the`.
    - Edge cases include no blanks, too many blanks, comma-separated alternatives, or malformed answer arrays.
    - Offline version should keep the same parsing and canonicalization logic because it is very useful for weak local models.

- `matching-v1`:
    - Current code supports `pairs`, `items`, or `terms/definitions` inputs and generates stable IDs.
    - It also validates in-browser and records interaction volatility.
    - Edge cases include duplicate terms, mismatched pair counts, empty definitions, and shuffled order confusion.
    - Offline version should keep matching because it is deterministic and does not require cloud validation.

- `timeline-v1`:
    - Current code uses drag and keyboard controls and tracks move count and interaction trace.
    - Edge cases include empty event lists, too many events, cyclical order ambiguity, and reorder drift.
    - Offline version should cap timelines to a small set of events and prefer short, unambiguous sequences.

- `signal-comparison-v1`:
    - Current code compares two signals and captures reasoning.
    - Edge cases include very long inputs, unclear selected side, or insufficient explanation length.
    - Offline version should keep it only if the comparison is textual and compact; otherwise it becomes too expensive for the device.

- `diagram-generator-v1`:
    - Current code tolerates labels, nodes, edges, and multiple semantic types, and it truncates overly large graphs.
    - Edge cases include hallucinated node counts, edge references to missing nodes, and semantic fallback when no type is provided.
    - Offline version should keep this as a text-first diagram widget with hard caps on node count and layout complexity.

- `analogy-v1`:
    - Current code handles acceptable answers, comma-separated answer alternatives, and fuzzy matching.
    - Edge cases include multiple valid answers, ambiguous analogies, and answers with extra whitespace or articles.
    - Offline version should keep it, but ask the model for fewer alternatives and shorter explanations.

- `spaced-review-v1`:
    - Current code depends on BKT state and retention percentage to rank topics.
    - Edge cases include missing mastery history, empty queues, and stale timestamps.
    - Offline version should replace server BKT reads with local mastery history and a simple retention heuristic if needed.

- `tactical-sandbox-v1`:
    - Current code depends on callable Cloud Functions for run, submit, and attempt history.
    - Edge cases include sandbox unavailability, rate limiting, long code, and unsupported languages.
    - Offline version should not pretend to have secure execution if it cannot. The safe fallback is static analysis, a local pseudocode helper, or disabling the widget.

- `image-analysis-v1`:
    - Current code assumes a reachable image URL and a valid captioning-style prompt.
    - Edge cases include missing images and failed image loads.
    - Offline version should only keep it if images are local assets; otherwise remove it from the personal build.

### Why the current index.js branches exist

The current backend is full of defensive branches because the model is expected to fail in specific ways:

- `parseLlmJson` exists because models often return text around JSON, code fences, or partial JSON.
- `formatMentorSpeech` exists because small model output needs readability cleanup.
- `calculateConfidence` exists because raw confidence from the model is not reliable enough for mastery tracking.
- `validateTeachingOutput` exists because the system must repair common mistakes like `USE_WIDGETS`, wrong casing, missing `widgetData`, or widget ID mismatch.
- `evaluateWithCouncil` exists because the platform wants better correctness than a single model call would provide.
- The widget telemetry path exists because it lets the backend distinguish subjective widgets from objective ones.
- The sandbox and image generation branches exist because those actions are too risky or too expensive to treat like plain text answers.

For the offline personal version, the goal is not to delete all of those ideas. The goal is to collapse them into a simpler shape:

- keep JSON parsing and repair,
- keep widget normalization,
- keep a safe fallback to `SPEAK`,
- keep local validation,
- drop cloud-only validation layers,
- and replace remote side effects with local persistence or explicit disabled states.

### Offline execution policy by widget class

- `SPEAK` responses should always be allowed and should be the safe fallback.
- Objective widgets should be locally validated in the browser whenever possible.
- Widgets that require external execution must either be replaced or clearly marked unavailable offline.
- If the model is unsure, prefer a smaller, more deterministic widget rather than a large creative one.
- If the widget payload is malformed, the UI should either regenerate the widget or fall back to text coaching.

## 11. Features That Should Be Cut For The First Offline Release

These should be removed or hard-disabled initially:

- Login and role management.
- Teacher dashboards.
- Admin dashboards.
- Class rosters.
- Teacher assignment flows.
- Cloud sync.
- Cloud image generation.
- Browser-based code execution through external services.
- Multi-user or concurrent sessions.

## 12. Local Storage Recommendation

For a first offline personal build, use the simplest reliable storage layer that fits the chosen packaging.

### Option A: Browser-first offline app

- IndexedDB for chat history and progress.
- Local settings in `localStorage`.
- Best when keeping the app in the browser.

### Option B: Local desktop wrapper

- SQLite or a local JSON database.
- Best when packaging the app later with a desktop shell.

### Recommended choice for first pass

Use IndexedDB first if you want the smallest code change. Use SQLite if you already plan to add a desktop wrapper.

## 13. Emulator Decision

The current repo has Firebase emulator support in `firebase.json`, but the frontend does not fully wire into it yet.

For the offline personal build:

- If you want a pure local web app, do not depend on Firebase emulators at all.
- If you want to keep Firebase APIs during development, wire emulators explicitly in the frontend and backend.

Since the goal is a personal offline clone, local persistence is the better long-term design than emulators.

## 14. Resource Budget Rules

These are the rules the offline version should follow on this device:

- One user session at a time.
- One LLM request chain at a time.
- No parallel council fan-out.
- No background batch jobs while tutoring.
- No heavy tabs or features that compete with the model for RAM.
- Disable image generation by default.
- Disable code execution by default.
- Keep widget JSON compact.

## 14.1 Edge Cases And Recovery Paths

The personal offline build should explicitly handle these failure modes.

### Ollama and model failures

- Ollama not running: show a local banner that says the tutor is unavailable and offer a `Retry` button.
- Model missing: show the exact model name that needs to be pulled and offer a setup hint.
- Model load too slow: keep the UI responsive and mark the tutor as `Starting...` instead of freezing.
- Context too long: auto-trim chat history and summarize older turns.
- JSON malformed from the model: retry once with a repair prompt, then fall back to `SPEAK`.

### Resource pressure failures

- RAM pressure: reduce context length and disable heavy widgets before retrying.
- VRAM pressure: lower the model tier or force CPU fallback for the local session.
- Browser freeze risk: cap visible messages, compact canvases, and avoid large SVG or JSON payloads.
- Long idle sessions: save progress periodically so a crash does not lose work.

### Data and storage failures

- Corrupted local session file or IndexedDB state: allow a clean reset and a backup import path.
- Missing widget payload: render a safe placeholder and do not crash the workspace.
- Invalid saved answer schema: normalize on load and ignore malformed records.

### Widget-specific failures

- MCQ with no options: show a load error and skip the turn.
- Fill-blank with no blanks: reject the widget and ask the model to regenerate.
- Matching with mismatched pairs: fail closed and fall back to a simpler widget.
- Timeline with too many items: truncate or regenerate to a smaller set.
- Diagram generator with too many nodes: cap the graph and show a warning node.
- Tactical sandbox unavailable: disable execution and fall back to static explanation.
- Image analysis without a local image source: hide the widget in offline mode.

### UX recovery behavior

- Never strand the user on a blank screen.
- Always keep a plain-text tutor fallback available.
- Always provide a way back to the main workspace.
- Always preserve the last successful session state if the tutor crashes.
- If a widget fails to render, fall back to the text explanation plus a smaller widget on retry.
- If the model is unavailable, still let the user review saved notes and previous answers.
- If the local profile is corrupted, offer a repair or reset option instead of blocking the app.

## 15. Prompting Rules For The Local Model

The offline personal build should use stricter prompts than the cloud version.

### General rules

- Require JSON only for structured outputs.
- Prefer short outputs.
- Prefer a single action field and compact widget data.
- If parsing fails, retry once with a repair prompt.
- If parsing still fails, fall back to `SPEAK`.

### Suggested adaptive policy

- Simple answer: one model call.
- Answer checking: one evaluator plus instructor.
- High-risk or ambiguous answer: all checks sequentially, but still one call at a time.
- Meta questions: skip heavy assessment.

## 16. Non-Goals

The offline personal version is not trying to be:

- A school deployment.
- A teacher-managed classroom platform.
- A multi-tenant SaaS.
- A cloud-hosted production service.
- A high-throughput inference server.

## 17. Suggested Implementation Order

Build in this order to reduce risk:

1. Make the local provider path the real backend path.
2. Remove or bypass cloud-only calls.
3. Add local storage for chat history and progress.
4. Reduce chat context length.
5. Add the ultra-low-resource model profile.
6. Keep widgets, but simplify widget JSON and fallback behavior.
7. Disable code execution and image generation.
8. Remove teacher/admin flows from the UI.
9. Polish the single-user offline home screen.

## 18. Acceptance Criteria

The offline personal version is done when:

- It runs locally without internet after models are installed.
- It opens to a single personal learning workspace.
- It can tutor with Ollama.
- It can store and reload local progress.
- It can render widgets without cloud dependencies.
- It does not require login.
- It does not expose teacher or admin flows.
- It stays usable on the RTX 2050 / 8 GB RAM machine without crashing under normal single-user use.

## 18.1 Offline Personal Tech Stack Summary

If you need a one-paragraph summary for Copilot or another implementation pass, use this:

- Frontend: Next.js 16 + React 19, but with a single personal route instead of role-based dashboards.
- State: client-side React state plus local persistence.
- Persistence: IndexedDB or a local JSON/SQLite layer.
- LLM: Ollama local inference, sequential calls only.
- Cloud services: not required for the core offline experience.
- Optional transitional mode: Firebase emulators only during development, not as the permanent offline backend.

## 19. Copilot Build Prompt

Use this prompt when asking Copilot to implement the offline version:

```text
Build a single-user, offline-first version of StudyPixel for a low-resource PC.

Requirements:
- Remove auth, teacher, student, class, and admin flows.
- Keep only the personal tutoring experience.
- Replace cloud inference with local Ollama inference.
- Replace Firestore/Auth persistence with local storage.
- Keep the widget system, but make it compact and reliable.
- Use sequential model calls only.
- Limit context length to a few recent turns.
- Disable image generation and code execution by default.
- Make the app runnable without internet after setup.

Important repo facts:
- Frontend is Next.js in studypixel/.
- Main tutoring UI is in studypixel/src/components/pixelbot/PixelBotWorkspace.js.
- Firebase client setup is in studypixel/src/lib/firebase.js.
- The production backend is in functions/index.js and is still cloud-first.
- A local Ollama backend exists in functions/index.local.js.
- Local model profiles are in functions/config/models.local.js.

Implement the offline clone as a small, stable personal learning app for one learner on one machine.
```

## 20. Practical Verdict

This repo is close to a local tutoring loop, but the offline personal build still needs a deliberate architecture cut. The safest result for this machine is a stripped-down personal tutor with local storage, sequential Ollama calls, and a much smaller scope than the current classroom-oriented system.
