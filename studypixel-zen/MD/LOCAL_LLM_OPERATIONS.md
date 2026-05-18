# Local LLM Operations

This document explains how StudyPixel Zen manages Ollama and local model behavior.

Zen is designed for small local models and low-resource hardware. Reliability matters more than model size.

## Runtime Endpoint

Zen uses two Ollama endpoints:

```text
http://localhost:11434/api/tags
http://localhost:11434/v1/chat/completions
```

`/api/tags` checks installed models.

`/v1/chat/completions` sends local tutor requests.

## Model Strategy

Recommended models:

- `qwen2.5:0.5b`
- `llama3.2:1b`
- `phi3:mini`
- `phi3.5:mini`

Selection strategy:

1. Start with `qwen2.5:0.5b`.
2. Move up only if quality is too weak.
3. Move down immediately if memory pressure, timeout, or VRAM errors appear.

## Why No Model Council

The old cloud backend used evaluator roles and model councils. That is not suitable for the offline personal edition.

Zen avoids:

- parallel evaluator calls
- multi-model fanout
- background analysis jobs
- redundant model calls

Reason:

- one RTX 2050 with 4 GB VRAM cannot reliably sustain council-style inference.

## Sequential Queue

Tutor requests go through a simple queue in `src/app/api/tutor/route.js`.

Purpose:

- prevent overlapping local inference
- reduce VRAM contention
- keep UI behavior predictable

Behavior:

- request A starts
- request B waits
- failed request does not poison the queue
- next request can still run

## Prompt Shape

Tutor prompt rules:

- compact
- deterministic
- current topic included
- profile name included
- session summary included if present
- enabled widget list included
- strict JSON contract included
- learner message truncated

The model is told:

- return strict JSON
- do not output markdown
- use `SPEAK` if unsure

## Output Repair

If model output is not parseable:

1. Zen sends a repair prompt.
2. The repair prompt asks for exactly one JSON object.
3. The repair call uses low temperature and smaller token budget.
4. If repair fails, Zen returns `SPEAK`.

Repair is limited to one attempt so the app does not loop or overload local inference.

## Timeouts

Default tutor timeout:

- about 45 seconds

Repair timeout:

- about 25 seconds

Why:

- local models may cold-start slowly
- but the UI should not hang indefinitely

Timeout result:

- API returns fallback `SPEAK`
- failure state indicates timeout
- user can retry or switch model

## Failure Classification

Zen classifies model failures into readable states.

| Failure | Meaning |
| --- | --- |
| Ollama not running | localhost endpoint not reachable |
| Model Missing | selected model is not installed |
| Inference timeout | model did not respond quickly enough |
| Context overflow | prompt/context exceeded model limits |
| VRAM exhaustion | GPU/memory failure |
| Error | unknown failure |

## Handling Weak Models

Small models may:

- ignore JSON instructions
- choose bad widget schemas
- overuse plain speech
- hallucinate fields
- produce incomplete options

Zen handles this by:

- JSON extraction
- repair retry
- widget normalization
- widget fallback
- compact prompts

User strategy:

- ask for one thing at a time
- prefer simple widgets
- use short topic descriptions
- avoid dumping large source text

## Local Model Install Commands

```powershell
ollama pull qwen2.5:0.5b
ollama pull llama3.2:1b
ollama pull phi3:mini
ollama pull phi3.5:mini
```

List models:

```powershell
ollama list
```

API health:

```powershell
curl http://localhost:11434/api/tags
```

## Operating Rules On Low VRAM

Recommended:

- one Zen tab
- one model
- one tutor request at a time
- close other GPU-heavy apps
- restart Ollama after large model failures
- use `qwen2.5:0.5b` for recovery

Avoid:

- running another local AI app during study
- switching quickly between large models
- asking for large diagrams
- long pasted documents
- repeated retry loops

## Offline Guarantee Boundary

Offline means:

- after dependencies and model are installed
- normal study runs through localhost
- state is stored locally
- no cloud model API is required

Offline does not mean:

- the app can install models without internet
- npm dependencies install without internet
- new models can be pulled without internet

## Operational Acceptance

Local LLM operation is acceptable when:

- Ollama health check works
- selected model appears in tags
- model test succeeds
- tutor can produce `SPEAK`
- malformed output recovers
- timeout returns readable fallback
- optional widgets can be disabled under pressure
