# Running StudyPixel Locally — ASUS TUF (8 GB RAM / 4 GB VRAM)

This guide sets up the **local Ollama** backend so you can develop and test without any cloud API keys or usage costs.

---

## Architecture

```
Browser (React)
    ↓ HTTPS
Firebase Emulator (functions/index.local.js)
    ↓ OpenAI-compat REST
Ollama  (localhost:11434)
    ↓ CUDA
phi3.5:mini — running on your RTX 3050 / GTX 1650
```

The local version runs all council roles (Router, Evaluators A/B/C, Instructor) **sequentially** through a single `phi3.5:mini` instance.  This fits comfortably in 4 GB VRAM (~2.3 GB used).

---

## Step 1 — Install Ollama

```bash
# Linux / WSL2
curl -fsSL https://ollama.com/install.sh | sh

# Windows (native)
# Download from https://ollama.com/download
```

---

## Step 2 — Pull the model

```bash
# Recommended (~2.3 GB download, ~2.3 GB VRAM at Q4)
ollama pull phi3.5:mini

# Lighter alternative (~1.5 GB) — lower quality but faster on weaker GPUs
ollama pull gemma2:2b
```

> To use `gemma2:2b` instead, edit `functions/config/models.local.js` and change every `phi3.5:mini` reference to `gemma2:2b`.

---

## Step 3 — Start Ollama with maximum GPU offload

```bash
OLLAMA_GPU_LAYERS=999 ollama serve
```

Leave this terminal open.  Verify it's running:

```bash
curl http://localhost:11434/api/tags
```

---

## Step 4 — Configure Firebase to use `index.local.js`

The emulator reads whichever file is listed as `"source"` in `firebase.json`.  Temporarily point it at the local backend:

```json
// firebase.json  (change only for local dev — revert before deploying)
"functions": {
  "source": "functions",
  "main": "index.local.js"
}
```

Alternatively, create a `firebase.local.json`:

```json
{
  "functions": { "source": "functions", "main": "index.local.js" },
  "emulators": {
    "functions": { "port": 5001 },
    "firestore": { "port": 8080 },
    "auth":      { "port": 9099 },
    "ui":        { "enabled": true }
  }
}
```

Then run:

```bash
firebase emulators:start --config firebase.local.json
```

---

## Step 5 — Point the React app at the emulator

In `studypixel/.env.local`:

```
NEXT_PUBLIC_USE_EMULATOR=true
```

The `firebase.js` config in the frontend already reads this variable to swap
`connectFunctionsEmulator(functions, "localhost", 5001)`.

---

## Latency expectations

| Step | Time on RTX 3050 |
|---|---|
| Intent classification (128 tokens) | ~0.5 s |
| Evaluator A (256 tokens) | ~1.0 s |
| Evaluator B (256 tokens) | ~1.0 s |
| Evaluator C (256 tokens) | ~1.0 s |
| Instructor (512 tokens) | ~2.0 s |
| **Total per turn** | **~5–6 s** |

On a GTX 1650 (slower), expect ~8–10 s per turn.

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `ECONNREFUSED localhost:11434` | Ollama is not running — run `ollama serve` |
| `404 model not found` | Pull the model: `ollama pull phi3.5:mini` |
| CUDA OOM / crash | Reduce `OLLAMA_GPU_LAYERS` to 20 to force CPU+GPU split |
| Very slow responses | Your GPU isn't being used; check `nvidia-smi` and confirm `OLLAMA_GPU_LAYERS=999` |
| JSON parse errors from model | `phi3.5:mini` output quality varies; switch to `gemma2:2b` in `models.local.js` |

---

## Switching back to API inference

Revert `firebase.json` to `"main": "index.js"` and ensure `DIGITALOCEAN_API_KEY` is set in `.env.studypixel-9d599`.
