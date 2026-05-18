# Researcher Workflow

StudyPixel Zen can be used as a local, reproducible tutoring loop for reading papers, testing conceptual understanding, and building personal study traces without cloud dependency.

This workflow is for researchers, students, and builders who want repeatable local experiments rather than a classroom product.

## Research Use Case

Zen is useful when you want to:

- study a paper offline
- convert concepts into recall exercises
- compare model behavior across small local models
- track mastery over several sessions
- export local study traces
- avoid cloud logging of study material

## Recommended Research Setup

Hardware-conservative setup:

- model: `qwen2.5:0.5b` or `llama3.2:1b`
- one browser tab
- one active topic
- optional heavy widgets off if the session grows long

Higher-quality setup:

- model: `phi3:mini` or `phi3.5:mini`
- use shorter prompts
- export backup after each study block

Avoid:

- running multiple local LLM tools at the same time
- switching models mid-experiment unless that is the experiment
- asking for large multi-widget outputs
- pasting entire papers into a prompt

## Suggested Paper Study Flow

1. Create a topic named after the paper.
2. Add a short description of the research area.
3. Ask the tutor for a plain-language summary.
4. Ask for an MCQ on the core claim.
5. Ask for a flashcard for definitions.
6. Ask for a matching exercise for terms and meanings.
7. Ask for a timeline if the paper describes a process.
8. Ask for an analogy if the idea is abstract.
9. Export backup after the study block.

Example prompts:

```text
Summarize the main contribution of this paper in compact terms.
```

```text
Make a simple MCQ that checks whether I understood the evaluation metric.
```

```text
Turn these three terms into matching practice.
```

```text
Give me an analogy for the difference between pretraining and fine-tuning.
```

## Reproducibility Practices

For a clean experiment:

- keep the same model for one run
- record the model name
- keep the same starter topic
- export backup before and after
- avoid editing old turns
- avoid switching optional widget settings mid-run
- write down whether Ollama was cold-started or already warm

Minimum metadata to record:

- date
- model
- topic
- seed pack
- number of turns
- memory pressure state if visible
- whether optional widgets were enabled

## Comparing Local Models

When comparing model behavior:

1. Export a backup before the run.
2. Choose model A.
3. Use the same first prompt.
4. Save/export after the session.
5. Restore the initial backup.
6. Choose model B.
7. Repeat the same prompt sequence.

Compare:

- JSON validity
- widget selection quality
- tutoring clarity
- tendency to over-explain
- speed
- timeout frequency
- malformed widget payload rate

## Widget-Based Research Protocol

Use widgets as structured probes.

| Widget | Research Use |
| --- | --- |
| `mcq-v1` | fast factual understanding |
| `mcq-reasoning-v1` | explanation quality and confidence |
| `flashcard-v1` | definitions and recall |
| `fill-blank-v1` | vocabulary and precise terms |
| `matching-v1` | relation mapping |
| `timeline-v1` | process order |
| `analogy-v1` | transfer and abstraction |
| `spaced-review-v1` | retention planning |

Optional:

- `diagram-generator-v1` for compact concept maps
- `signal-comparison-v1` for side-by-side technical comparison

Disabled initially:

- `image-analysis-v1`
- `tactical-sandbox-v1`

## Local Data Artifacts

Research data is stored locally in:

- IndexedDB primary state
- localStorage snapshot
- exported backup JSON

State includes:

- profile
- settings
- sessions
- archived sessions
- review queue
- mastery
- summaries
- widget submissions

Do not treat browser local storage as permanent archival storage. Export backups for anything important.

## Privacy Notes

Normal Zen runtime does not require:

- Firebase
- Firestore
- cloud auth
- OpenAI
- Gemini
- DigitalOcean
- Judge0

Your study content remains local unless you manually copy it elsewhere or install a model/tool that sends data out.

## Low-Resource Experiment Settings

Recommended:

- model: `qwen2.5:0.5b`
- max one active session
- one topic per run
- compact prompts
- avoid diagrams unless needed
- disable optional heavy widgets if memory pressure rises

If model quality is too weak:

1. Try `llama3.2:1b`.
2. Try `phi3:mini`.
3. Keep prompts shorter.
4. Ask for one widget at a time.

## Session End Routine

At the end of each research block:

1. Ask for a short summary of what you learned.
2. Ask for review questions.
3. Export backup.
4. Note the model used.
5. Close the tab if you are done.

This keeps the local state compact and reproducible.

## Known Limitations

- Small local models may produce weaker explanations.
- JSON repair handles many errors but not every hallucinated schema.
- The first offline release uses local mastery heuristics, not the full old cloud BKT pipeline.
- Tactical code execution is disabled until a safe local executor exists.
- Image analysis is disabled initially for hardware stability.

## Research Acceptance Checklist

A research run is usable when:

- the model is fixed for the run
- the first prompt is recorded
- the topic is named clearly
- widget outputs are saved through local state
- backup export succeeds
- failures are noted as part of the run rather than silently ignored
