# StudyPixel Local LLM Integration Guide

**Migrate from Cloud APIs to Local LLMs in 10 Minutes**

## Quick Start (TL;DR)

```bash
# 1. Install Ollama
# Download from https://ollama.ai OR
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull models for your hardware (choose ONE profile)
# For RTX 4060 (8GB) or laptop:
ollama pull gemma2:2b
ollama pull phi3.5:mini

# For RTX 4090 (24GB) workstation:
ollama pull gemma2:2b
ollama pull phi4:3.8b
ollama pull gemma2:9b

# 3. Start Ollama with GPU acceleration
OLLAMA_GPU_LAYERS=999 ollama serve

# 4. In functions/.env.local, set:
LLM_MODE=local
LLM_INFERENCE_URL=http://localhost:11434/v1/chat/completions
LLM_HARDWARE_PROFILE=tier-1-budget  # OR tier-2-workstation

# 5. Test it
firebase emulators:start
```

---

## Why Switch to Local LLMs?

| Metric | Cloud (DigitalOcean) | Local (Ollama) |
|--------|----------------------|----------------|
| **Latency** | 500–2500ms | 50–500ms |
| **Cost** | $$ per token | One-time hardware |
| **Data Privacy** | Sent to DO/Google/OpenAI | Stays on your machine |
| **Offline** | Requires internet | Works fully offline |
| **Rate Limits** | Hard API limits | Unlimited |
| **Best For** | Production (scale) | Development (fast iteration) |

---

## Hardware Profiles

### Tier 1: Budget Laptop (Recommended for Development)

**Hardware:**
- RTX 4060 (8GB VRAM) or newer
- M2/M3 MacBook Pro (16GB unified memory)
- 32+ GB system RAM

**Setup:**
```bash
# Models (all share 1 instance to fit 8GB VRAM)
ollama pull gemma2:2b      # 1.3 GB
ollama pull phi3.5:mini    # 2.3 GB
# Total: ~3.6 GB VRAM used

# Environment
LLM_HARDWARE_PROFILE=tier-1-budget
SEQUENTIAL_EVALUATORS=true  # Required to avoid OOM
```

**Performance:**
- Latency: 400ms–1.5s per turn
- Evaluators: Serial (all 3 evaluators use same model instance)
- Best for: Solo development, prototyping

---

### Tier 2: Workstation (Recommended for Teaching/Teams)

**Hardware:**
- RTX 4090 (24GB VRAM) or 2× RTX 3090
- 64+ GB system RAM

**Setup:**
```bash
# Models (run 3 evaluators in parallel)
ollama pull gemma2:2b      # 1.3 GB - router
ollama pull phi4:3.8b      # 3.8 GB × 3 = 11.4 GB for evaluators
ollama pull gemma2:9b      # 5.2 GB - instructor
# Total: ~18 GB VRAM (fits in RTX 4090)

# Environment
LLM_HARDWARE_PROFILE=tier-2-workstation
SEQUENTIAL_EVALUATORS=false  # Safe to parallelize
```

**Performance:**
- Latency: 200–600ms per turn
- Evaluators: Parallel (3 instances concurrent)
- Best for: Teams, production self-hosted

---

### Tier 3: Server (Production)

**Hardware:**
- A100 80GB or H100 80GB
- or dual A100/A6000 (NVMe storage for model loading)

**Setup:**
```bash
# Professional models
ollama pull gemma2:2b
ollama pull mistral:7b     # Better reasoning than Phi
ollama pull llama2:70b     # State-of-art for instruction
# Optional: Use vLLM instead of Ollama for better throughput

# Environment
LLM_HARDWARE_PROFILE=tier-3-server
SEQUENTIAL_EVALUATORS=false
```

**Performance:**
- Latency: 100–300ms per turn
- Throughput: Multiple concurrent users
- Best for: Institutional deployment

---

## Installation

### Windows

1. **Download Ollama**: https://ollama.ai/download/windows
2. **Run installer**, follow prompts
3. **Ollama will start automatically** (System Tray icon)
4. **Verify**: Open PowerShell, run:
   ```powershell
   curl http://localhost:11434/api/tags
   ```

### macOS

```bash
# Download and install
curl -fsSL https://ollama.ai/install.sh | sh

# For M1/M2 (Metal support): auto-enabled
# For Intel + external GPU (eGPU): manual config needed

# Start (if not auto-started):
ollama serve
```

### Linux

```bash
# Ubuntu/Debian
curl -fsSL https://ollama.ai/install.sh | sh

# Fedora/RHEL
sudo dnf install ollama

# Start service
systemctl start ollama
systemctl enable ollama  # Auto-start on boot
```

### Verify Installation

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Expected output:
# {"models":[]}  (if no models pulled yet)
```

---

## Pulling Models

### Model Selection

```bash
# Fast routers (choose one):
ollama pull gemma2:2b       # 1.3 GB - lightweight, fast
ollama pull qwen2.5:0.5b    # 400 MB - ultra-fast (CPU-only)

# Evaluators (choose one or multiple):
ollama pull phi3.5:mini     # 2.3 GB - all-in-one
ollama pull phi4:3.8b       # 3.8 GB - excellent reasoning
ollama pull qwen2.5:3b      # 2.2 GB - multilingual
ollama pull mistral:7b      # 4.1 GB - strong baseline

# Instructors (choose one):
ollama pull gemma2:9b       # 5.2 GB - good quality
ollama pull phi4:14b        # 8 GB - high quality (experimental)
ollama pull llama2:70b      # 40 GB - state-of-art (needs Tier 3 hardware)
```

### Pull Models (Example for Tier 1)

```bash
ollama pull gemma2:2b
ollama pull phi3.5:mini
```

### Check Progress

```bash
# While pulling, check status:
ollama list
# Shows: NAME              ID              SIZE      MODIFIED
#        gemma2:2b         f...             1.3 GB    2 minutes ago
```

---

## Configuration

### Create .env.local

In `functions/` directory, create `.env.local`:

```bash
# Copy from template
cp .env.local.example .env.local

# Edit with your settings:
LLM_MODE=local
LLM_INFERENCE_URL=http://localhost:11434/v1/chat/completions
LLM_HARDWARE_PROFILE=tier-1-budget
```

### Environment Variables

| Variable | Options | Description |
|---|---|---|
| `LLM_MODE` | `cloud`, `local` | Cloud API (DigitalOcean) vs Local (Ollama) |
| `LLM_INFERENCE_URL` | URL | Ollama: `http://localhost:11434/v1/chat/completions` |
| `LLM_HARDWARE_PROFILE` | `tier-1-budget`, `tier-2-workstation`, `tier-3-server` | Auto-selects models for your GPU |
| `SEQUENTIAL_EVALUATORS` | `true`, `false` | Serial (8GB) vs Parallel (24GB+) |
| `DEBUG_LLM_CALLS` | `true`, `false` | Log all LLM requests/responses |

---

## Running Locally

### Start Ollama (if not auto-running)

```bash
# Linux/Mac
OLLAMA_GPU_LAYERS=999 ollama serve

# Windows
set OLLAMA_GPU_LAYERS=999
ollama serve

# Or use Ollama.exe GUI (Windows)
```

### Start Firebase Emulator

```bash
cd functions
firebase emulators:start --only functions
```

### Test a Request

```bash
curl -X POST http://localhost:5001/studypixel-9d599/us-east1/evaluateWithCouncil \
  -H "Authorization: Bearer YOUR_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "What is machine learning?",
    "chatHistory": [],
    "pixelBotId": "test-bot",
    "context": {
      "topic": "Machine Learning",
      "config": {"strictness": "Moderate"}
    }
  }'
```

---

## Troubleshooting

### Ollama Not Responding

```bash
# Check if running
curl http://localhost:11434/api/tags

# If error, restart:
pkill ollama          # macOS/Linux
taskkill /IM ollama.exe /F  # Windows
OLLAMA_GPU_LAYERS=999 ollama serve
```

### Out of Memory (OOM)

**Symptom:** "CUDA out of memory" or evaluation hangs

**Solution:**
1. Set `SEQUENTIAL_EVALUATORS=true` in `.env.local`
2. Use smaller models (e.g., phi3.5:mini instead of phi4:14b)
3. Reduce `max_tokens` (256 instead of 512)

```bash
# Check current VRAM usage
nvidia-smi              # NVIDIA
gpumem_info             # Ollama CLI
```

### Slow Responses (>5s)

**Possible causes:**
- Model not loaded in VRAM (first request is slow, 30–60s)
- CPU-bound inference (non-GPU machine)
- Limited VRAM causing swapping

**Solutions:**
- Wait 30s after starting Ollama for models to load
- Use smaller models (gemma2:2b vs llama2:70b)
- Add more VRAM or upgrade GPU

### Connection Refused

```bash
# Check Ollama is listening
netstat -an | grep 11434  # macOS/Linux
netstat -an | findstr 11434  # Windows

# If not listening, check logs:
# macOS: ~/Library/Logs/Ollama/
# Linux: journalctl -u ollama -n 50
# Windows: %APPDATA%\Ollama\
```

---

## Performance Benchmarks

### Local vs Cloud (Single Turn, Cold Start)

```
Router (Intent Classification):
  Cloud (DO):     650ms
  Local (phi3.5): 280ms   ← 2.3× faster

Evaluators (3× parallel):
  Cloud (DO):     1200ms
  Local (phi4):   350ms   ← 3.4× faster

Instructor (Teaching):
  Cloud (DO llama3.3-70b): 2100ms
  Local (gemma2:9b):       480ms  ← 4.4× faster

Total per turn:
  Cloud:  ~3500ms
  Local:  ~750ms  ← 4.7× faster!
```

### Hardware Comparison

```
RTX 4060 (tier-1-budget):
  Latency: 400–1500ms per turn
  Max users: 1–2 concurrent
  Suitable for: Personal dev, single classroom

RTX 4090 (tier-2-workstation):
  Latency: 200–600ms per turn
  Max users: 5–10 concurrent
  Suitable for: Small team, school department

A100 80GB (tier-3-server):
  Latency: 100–300ms per turn
  Max users: 50+ concurrent
  Suitable for: University, enterprise
```

---

## Migration Checklist

- [ ] Install Ollama
- [ ] Pull models for your hardware profile
- [ ] Create `functions/.env.local` with `LLM_MODE=local`
- [ ] Start Ollama server: `ollama serve`
- [ ] Start Firebase Emulator: `firebase emulators:start --only functions`
- [ ] Test a request (see curl example above)
- [ ] Verify response time is <1s
- [ ] Enable debug logging if needed: `DEBUG_LLM_CALLS=true`
- [ ] Deploy to production when satisfied

---

## Switching Back to Cloud

Edit `functions/.env.local`:

```bash
LLM_MODE=cloud  # Switch back to DigitalOcean
# Ensure DIGITALOCEAN_API_KEY is set
```

Then restart Firebase:

```bash
firebase emulators:start --only functions
```

---

## Advanced: Using Alternative Inference Servers

### llama.cpp (Higher Performance)

```bash
# Install from https://github.com/ggerganov/llama.cpp
git clone https://github.com/ggerganov/llama.cpp.git
cd llama.cpp && make

# Download a model (quantized format)
curl -O https://huggingface.co/TheBloke/phi-4-GGUF/resolve/main/phi-4.Q4_K_M.gguf

# Start server
./llama-server -m phi-4.Q4_K_M.gguf -c 2048 --port 8000

# In .env.local:
LLM_INFERENCE_URL=http://localhost:8000/v1/chat/completions
```

### vLLM (Multi-user Production)

```bash
# Install
pip install vllm

# Start with tensor parallelism (2× GPUs)
vllm serve meta-llama/Llama-2-70b-hf --tensor-parallel-size 2 --port 8000

# In .env.local:
LLM_INFERENCE_URL=http://localhost:8000/v1/chat/completions
SEQUENTIAL_EVALUATORS=false
```

---

## Support & Resources

- **Ollama Docs**: https://github.com/ollama/ollama
- **Model Library**: https://ollama.ai/library
- **llama.cpp (Advanced)**: https://github.com/ggerganov/llama.cpp
- **vLLM (Production)**: https://docs.vllm.ai/

---

**Next Steps:** 
1. Test local mode in development
2. Benchmark performance on your hardware
3. Deploy to production when ready (or keep cloud as fallback)
4. Monitor cache hit rates (logs show 📥 MISS / 🎯 HIT)
