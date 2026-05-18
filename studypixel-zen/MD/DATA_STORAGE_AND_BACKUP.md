# Data Storage And Backup

StudyPixel Zen stores user progress locally. There is no Firestore requirement for ordinary runtime.

## Storage Philosophy

Zen is a personal offline app, so local data should be:

- private by default
- recoverable
- exportable
- importable
- resilient to corrupted records
- small enough for browser storage

## Storage Layers

```text
IndexedDB
  -> localStorage snapshot
  -> exported JSON backup
```

IndexedDB is the primary store.

localStorage is a small snapshot fallback.

Backup JSON is the user-controlled recovery format.

## Main Storage File

Implementation:

- `src/storage/zenStorage.js`

Key constants:

- DB name: `studypixel-zen-db`
- store name: `state`
- localStorage key: `studypixel-zen-state-v2`
- schema version: `2`

## Stored State Shape

State contains:

- `schemaVersion`
- `profile`
- `settings`
- `sessions`
- `sessionArchive`
- `reviewQueue`
- `mastery`
- `history`
- `summaries`
- `widgetSubmissions`

## Profile

Profile stores:

- learner name
- current topic
- creation time

Profile must not store:

- Firebase UID
- classroom role
- teacher id
- organization id
- cloud auth token

## Settings

Settings store:

- selected model
- model tier
- heavy widget preference

Settings should remain small and portable.

## Sessions

Sessions should represent active or recent study work.

Session data should avoid:

- huge raw model responses
- large pasted documents
- unbounded telemetry traces
- giant widget payloads

If sessions grow long, older turns should be summarized or archived.

## Session Archive

Archive stores older sessions after active-session limits are exceeded.

Purpose:

- keep the current UI responsive
- preserve continuity
- avoid retaining huge active arrays

## Review Queue

Review queue stores due or upcoming review topics.

It should support:

- empty queue
- stale timestamps
- missing mastery values
- local heuristic defaults

## Mastery

Mastery is local and personal.

It is not the same as the old Firestore adaptive profile, but preserves the idea:

- topic progress
- review readiness
- local learning continuity

## Widget Submissions

Widget submissions are useful for:

- deterministic local grading
- review history
- debugging widget behavior
- research exports

Keep them compact.

Avoid storing:

- large screenshots
- huge code blobs
- full model logs
- unnecessary raw prompt dumps

## State Sanitization

Every loaded or imported state is sanitized.

Sanitization handles:

- missing arrays
- malformed objects
- missing settings
- missing profile
- old schema shape
- unexpected null values

Invalid pieces are replaced with safe defaults.

## Backup Export

Backup export returns formatted JSON.

Use export:

- before deleting old folders
- before major code edits
- after important study sessions
- before resetting progress
- before testing imports

Recommended filename:

```text
studypixel-zen-backup-YYYY-MM-DD.json
```

## Backup Import

Backup import:

1. Parses JSON.
2. Sanitizes the state.
3. Persists the safe result.

If import fails:

- confirm file is valid JSON
- confirm it is a Zen backup
- try an older backup

## Reset

Reset should:

- clear profile progress
- restore default settings
- clear sessions and queues
- keep the app usable

Before reset:

- export backup

## Corruption Recovery

If state appears corrupt:

1. Export current state if possible.
2. Import last known-good backup.
3. Refresh.
4. If still broken, reset.
5. Re-seed topics.

## Privacy Boundary

Local storage is private to the browser profile on the machine, but it is not encrypted by Zen.

For sensitive study material:

- use your OS account password
- store backups in a safe folder
- avoid syncing backups to cloud drives unless intentional

## Future SQLite Packaging

SQLite may be useful later if Zen becomes a packaged desktop app.

For browser-first Zen:

- IndexedDB is preferred
- localStorage remains fallback
- SQLite is not required

## Acceptance Checklist

Storage is acceptable when:

- state persists after refresh
- IndexedDB failure falls back safely
- localStorage snapshot works
- export produces readable JSON
- import restores valid state
- reset returns safe defaults
- corrupted records do not crash startup
