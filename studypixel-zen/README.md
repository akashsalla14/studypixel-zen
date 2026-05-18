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

## What this folder contains

- `src/app/page.js` - the Zen launcher and workspace shell
- `src/app/api/tutor/route.js` - local tutoring API with Ollama fallback logic
- `src/components/ZenApp.js` - setup, hub, workspace, settings, and review queue screens
- `src/lib/localStore.js` - local persistence helpers
- `src/lib/tutor.js` - JSON parsing and response normalization
- `src/components/externalWidgets.js` - adapters that reuse the existing widget components from `../studypixel`

## Notes

The app is intentionally compact for low-resource laptops. It uses a single active model, sequential calls only, and falls back to SPEAK when the model response is malformed or unavailable.
