# StudyPixel Zen Installation For Everyone

This guide is for non-technical learners, local builders, and researchers who want StudyPixel Zen to run as a private offline tutor.

Zen is designed to work like this:

```text
Browser -> Next.js app -> local tutor API -> Ollama on localhost -> local browser storage
```

After Node, Ollama, and at least one model are installed, normal study sessions do not need the internet.

## What You Need

Minimum practical setup:

- Windows 10 or 11.
- Node.js 20 or newer.
- Ollama.
- One small local model.
- 8 GB RAM or more.

Target low-resource setup:

- NVIDIA RTX 2050 or similar 4 GB VRAM GPU.
- Around 8 GB system RAM.
- One active browser tab.
- One local model loaded at a time.

## Recommended Models

Start with the smallest model first.

| Model | Best Use | Why |
| --- | --- | --- |
| `qwen2.5:0.5b` | first setup, weak hardware, fallback tutor | tiny and fast |
| `llama3.2:1b` | general tutoring | still small, better language quality |
| `phi3:mini` | reasoning-heavy study | stronger but heavier |
| `phi3.5:mini` | better quality if your machine can handle it | stronger local tutor |

Avoid large models for this edition unless you know your machine can handle them. Zen is intentionally optimized for stability over raw model size.

## Quick Install On Windows

1. Install Node.js LTS from `https://nodejs.org`.
2. Install Ollama from `https://ollama.com/download`.
3. Open PowerShell.
4. Go to the Zen folder:

```powershell
cd "C:\Users\Asus\Downloads\Studypixel-zen\StudyPixel-main (1)\StudyPixel-main\studypixel-zen"
```

5. Install dependencies:

```powershell
npm.cmd install
```

6. Pull the smallest recommended model:

```powershell
ollama pull qwen2.5:0.5b
```

7. Start the app:

```powershell
npm.cmd run dev
```

8. Open:

```text
http://localhost:3000
```

9. In the Setup screen:

- click `Recheck runtime`
- choose your installed model
- click `Test model`
- create or confirm your local profile
- choose a starter topic

## PowerShell Note

If `npm run dev` fails with a script policy error, use:

```powershell
npm.cmd run dev
```

This avoids the PowerShell `npm.ps1` execution policy issue.

## One-Command Ollama Health Check

Run:

```powershell
curl http://localhost:11434/api/tags
```

Expected:

- a JSON response containing installed models.

If it fails:

- start the Ollama app
- wait a few seconds
- run the command again
- click `Recheck runtime` in Zen

## Install Additional Models

Use any of these:

```powershell
ollama pull qwen2.5:0.5b
ollama pull llama3.2:1b
ollama pull phi3:mini
ollama pull phi3.5:mini
```

Install only what you need. More installed models are fine, but running multiple local model jobs at once is not recommended on 4 GB VRAM.

## First Run Checklist

Before your first real study session:

- Start Ollama.
- Confirm `curl http://localhost:11434/api/tags` works.
- Start Zen with `npm.cmd run dev`.
- Open `http://localhost:3000`.
- Click `Recheck runtime`.
- Select an installed model.
- Run `Test model`.
- Create your profile.
- Pick a starter seed pack or custom topic.
- Export one backup after setup.

## Normal Offline Use

After setup:

1. Start Ollama.
2. Start Zen.
3. Open the Study Hub.
4. Continue your topic or start a new one.
5. Export backups when you finish important study blocks.

Internet is only needed for:

- installing Node
- installing Ollama
- pulling new models
- installing npm dependencies

## Updating Zen

If source code changes:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run dev
```

If your local progress matters, export a backup before updating.

## Verification Commands

Build check:

```powershell
npm.cmd run build
```

Lint note:

```powershell
npm.cmd run lint
```

At the time of this migration audit, lint cannot start until the project adds an ESLint 9 `eslint.config.*` file. The production build succeeds.

## If Something Goes Wrong

Use this order:

1. Recheck runtime in Setup.
2. Confirm Ollama is running.
3. Confirm the selected model exists.
4. Switch to `qwen2.5:0.5b`.
5. Close other heavy apps.
6. Export backup if possible.
7. Reset only as a last resort.

See `MD/TROUBLESHOOTING.md` for detailed recovery paths.
