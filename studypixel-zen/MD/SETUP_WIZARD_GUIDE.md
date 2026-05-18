# Setup Wizard Guide

The Setup screen is the control tower for StudyPixel Zen. It prepares the app for offline learning by checking the local runtime, choosing a model, creating a single learner profile, and seeding starter topics.

Zen should never start with a login wall, classroom dashboard, teacher portal, or cloud dependency. The setup flow is intentionally personal and local.

## Setup Goal

The Setup screen answers four questions:

1. Is Ollama reachable?
2. Which local models are installed?
3. Who is the local learner?
4. What should the first study topics be?

## Setup Flow

Expected first-run flow:

```text
Launch Zen
  -> runtime check
  -> model selection
  -> model responsiveness test
  -> profile creation
  -> starter topic seed
  -> Study Hub
```

Expected returning-user flow:

```text
Launch Zen
  -> hydrate local state
  -> runtime check
  -> continue to Study Hub
```

## Runtime Check

The runtime check calls the local tutor API health path, which asks Ollama for installed models.

Internally:

- Zen calls `/api/tutor` with a health request.
- The API uses `src/model/ollamaClient.js`.
- Ollama is checked at `http://localhost:11434/api/tags`.
- The result is converted into a readable runtime state.

## Runtime States

| State | Meaning | User Action |
| --- | --- | --- |
| Starting | Zen is checking local runtime | wait or recheck |
| Ready | Ollama is reachable and selected model exists | continue |
| Model Missing | Ollama is running but selected model is not installed | pull/select a model |
| Loading Model | model test is in progress or Ollama is warming up | wait |
| Offline Fallback | local model is unavailable but Zen can still preserve state | continue in limited mode |
| Error | unknown runtime failure | open troubleshooting |
| Recovering | Zen is retrying after a failed or stale runtime state | wait or recheck |

## Model Selection

Recommended order:

1. `qwen2.5:0.5b`
2. `llama3.2:1b`
3. `phi3:mini`
4. `phi3.5:mini`

The Setup dropdown should prefer installed models. If none are installed, it should still show recommended model names so the user knows what to pull.

## Model Responsiveness Test

The model test should be short. It exists only to confirm that:

- Ollama can load the model.
- The model can return text.
- The API route can complete without timing out.
- The UI can show a readable result.

It is not a benchmark.

Expected success:

- state becomes `Ready`
- model is saved in local settings
- user can continue to the Study Hub

Expected failure:

- state becomes `Model Missing`, `Inference timeout`, `VRAM exhaustion`, or `Error`
- user can switch model or recheck runtime
- profile and previous state remain intact

## Profile Creation

Zen supports one learner only.

Profile fields should stay compact:

- name
- current topic
- created timestamp

Do not add classroom role, teacher id, organization id, admin flags, cloud auth ids, or Firestore paths to the personal profile.

## Seed Packs

Seed packs are local starter templates. They should create helpful first topics without requiring an account or remote database.

Current seed packs:

- Beginner Starter
- AI Research Starter
- Security Practice Starter

Suggested behavior:

- user can accept a seed pack
- user can override topic names
- user can skip seeding
- seeded topics should be stored locally

## Seed Pack Details

### Beginner Starter

Purpose:

- first-time app validation
- simple learning loop
- quick widget tests

Suggested topics:

- Learning how to study with active recall
- Basic problem solving
- Memory and review

### AI Research Starter

Purpose:

- paper reading
- concept tracking
- reproducible local experiments

Suggested topics:

- Paper summary
- Method comparison
- Evaluation metrics
- Open questions

### Security Practice Starter

Purpose:

- security concept review
- terminology practice
- reasoning drills

Suggested topics:

- Threat modeling basics
- Vulnerability classification
- Secure coding review

## What Setup Must Not Do

Setup must not require:

- Firebase Auth
- Firestore
- Firebase Functions
- cloud model API keys
- teacher account
- admin role
- classroom selection
- internet after local model installation

## Recovery Behavior

If setup detects a problem:

- keep the selected topic and profile
- show a readable status
- preserve any typed user input
- allow recheck
- allow model switch
- allow fallback mode

Never strand the user on a blank page because Ollama is missing.

## Setup Acceptance Checklist

Setup is acceptable when:

- it opens with no internet
- it detects Ollama when running
- it detects no Ollama without crashing
- it lists installed models
- it can save selected model
- it creates a single local profile
- it seeds topics locally
- it can enter Study Hub
- it can recover from missing model
- it can preserve state after refresh
