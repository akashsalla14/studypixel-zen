# Widget Contract And Edge Cases

StudyPixel Zen preserves StudyPixel's widget-driven learning architecture while making widget selection local, deterministic, and safe under malformed model output.

## Core Rule

The model may suggest a widget, but Zen decides whether it is safe to render.

```text
LLM output
  -> parse
  -> normalize response
  -> check widget policy
  -> sanitize widgetData
  -> render widget or fall back to SPEAK
```

## Allowed Tutor Shapes

Plain speech:

```json
{
  "action": "SPEAK",
  "mentor_speech": "..."
}
```

Widget:

```json
{
  "action": "USE_WIDGET",
  "widgetId": "mcq-v1",
  "widgetData": {}
}
```

Any other shape is treated as plain speech.

## Widget Policy

Required:

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

## Why Whitelisting Exists

Whitelisting protects the app from:

- hallucinated widget names
- cloud-only tools
- heavy widgets on weak hardware
- malformed schemas
- old Firebase-era assumptions

Unknown widgets become `SPEAK`.

Disabled widgets become `SPEAK`.

## Base Data Normalization

Most widgets share:

- prompt
- hint
- explanation
- difficulty
- tags
- execution mode
- historical/read-only flag

Zen accepts common aliases:

- `title`
- `question`
- `task`
- `clue`
- `reasoning`
- `feedback`
- `level`

## MCQ Edge Cases

Expected:

```json
{
  "prompt": "Question?",
  "options": { "A": "One", "B": "Two" },
  "correctAnswer": "A"
}
```

Accepted aliases:

- `choices`
- `answers`
- `answer`
- `correct`

Repairs:

- array options become lettered options
- object options are normalized
- duplicate option text removed
- empty options removed
- answer text mapped back to option key
- max 8 options

Rejects:

- fewer than 2 valid options
- missing correct answer
- correct answer not present after repair

Fallback:

- `SPEAK`

## MCQ Reasoning Edge Cases

Adds:

- `requiresReasoning`
- `reasoningPrompt`

Accepted alias:

- `reasonPrompt`

Repairs:

- same as MCQ
- preserves reasoning prompt if present

Rejects:

- invalid base MCQ payload

## Flashcard Edge Cases

Expected:

```json
{
  "front": "Term or question",
  "back": "Answer or explanation"
}
```

Common aliases that should be tolerated by widget-level normalization:

- `question`
- `answer`
- `prompt`
- `definition`

Fallback goal:

- if front/back cannot be inferred, use `SPEAK`

## Fill Blank Edge Cases

Expected:

```json
{
  "sentence": "The capital of France is [BLANK].",
  "correctAnswers": [["Paris"]]
}
```

Accepted:

- `[BLANK]`
- underscores like `____`
- `correctAnswers`
- `answers`
- `answer`
- comma-separated alternatives

Repairs:

- infers blank count from sentence
- converts string answers to arrays
- supports multiple alternatives per blank
- caps blanks to 6

Grading tolerance:

- case-insensitive
- punctuation-insensitive
- article-insensitive through loose canonicalization

Rejects:

- no blanks
- no answers

## Matching Edge Cases

Expected:

```json
{
  "pairs": [
    { "term": "CPU", "definition": "Processes instructions" }
  ]
}
```

Accepted aliases:

- `left`
- `right`
- `prompt`
- `match`
- `answer`

Repairs:

- removes empty pairs
- removes duplicate term/definition pairs
- caps pairs at 8

Rejects:

- fewer than 2 valid pairs

## Timeline Edge Cases

Expected:

```json
{
  "events": ["First", "Second", "Third"],
  "correctOrder": [0, 1, 2]
}
```

Accepted:

- string events
- event objects with `label`, `event`, or `text`
- `steps` alias

Repairs:

- missing order becomes natural order
- malformed order becomes natural order
- caps events at 7

Rejects:

- fewer than 2 events

## Diagram Edge Cases

Expected:

```json
{
  "nodes": [{ "id": "a", "text": "Start" }],
  "edges": [{ "from": "a", "to": "b" }]
}
```

Repairs:

- caps nodes at 12
- caps edges at 20
- tolerates missing edges

Rejects:

- fewer than 2 nodes

Reason:

- diagrams can become visually and computationally heavy on low-resource hardware.

## Analogy Edge Cases

Expected:

```json
{
  "termA": "Seed",
  "termB": "Tree",
  "termC": "Idea",
  "correctAnswer": "Project",
  "acceptableAnswers": ["project", "plan"]
}
```

Accepted aliases:

- `A`
- `B`
- `C`
- `answer`
- `answers`
- `options`

Repairs:

- comma-separated acceptable answers
- missing acceptable answers inferred from correct answer
- missing terms become placeholders

Rejects:

- no correct answer

## Spaced Review Edge Cases

Expected:

```json
{
  "topics": [
    {
      "name": "Photosynthesis",
      "masteryScore": 0.6,
      "daysSinceReview": 2,
      "retentionPct": 75
    }
  ]
}
```

Accepted aliases:

- `queue`
- `topic`
- `mastery`
- `prompt`

Repairs:

- missing mastery defaults to 0
- missing days defaults to 0
- retention clamped 0 to 100
- caps topics at 10
- empty queue is allowed

## Telemetry Contract

Local telemetry should stay compact.

Fields:

- widgetId
- widgetVersion
- timestamp
- isCorrect
- usedHint
- interactionSource
- metrics

Telemetry is stored locally. It is not sent to Firestore.

## Widget Failure Policy

Never:

- crash the workspace
- show raw stack trace
- trust arbitrary model-selected widgets
- execute remote code
- force a broken widget render

Always:

- validate widget id
- sanitize widget data
- cap complexity
- fall back to `SPEAK`
- preserve session continuity

## Acceptance Checklist

Widget layer is acceptable when:

- all required widget IDs are registered
- disabled widgets are blocked
- optional widgets respond to memory pressure
- malformed MCQ falls back safely
- malformed fill blank falls back safely
- malformed matching falls back safely
- malformed timeline falls back safely
- malformed diagram falls back safely
- spaced review tolerates empty state
- widget submissions persist locally
