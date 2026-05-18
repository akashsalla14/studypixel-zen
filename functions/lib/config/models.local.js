/**
 * @fileoverview Local LLM model configuration for StudyPixel.
 *
 * Use this config when running locally with Ollama or llama.cpp.
 * Supports multiple hardware profiles and model families.
 *
 * Key advantages over cloud API:
 * - 50–100ms latency (vs. 500–2500ms cloud)
 * - Zero API costs
 * - Full privacy (data never leaves your machine)
 * - Instant iteration for prototyping
 *
 * SETUP INSTRUCTIONS:
 * ==================
 *
 * 1. Install Ollama (https://ollama.ai):
 *    Windows/Mac/Linux: Download and run installer
 *    OR: curl -fsSL https://ollama.com/install.sh | sh
 *
 * 2. Pull models (choose based on your GPU):
 *    For RTX 4060 (8GB):
 *      ollama pull gemma2:2b      # 1.3GB - fast router
 *      ollama pull phi3.5:mini    # 2.3GB - all-in-one model
 *
 *    For RTX 4090 (24GB):
 *      ollama pull gemma2:2b      # Router
 *      ollama pull phi4:3.8b      # Evaluators (pull 3 copies)
 *      ollama pull gemma2:9b      # Instructor
 *
 *    For A100/H100:
 *      ollama pull llama2:70b     # Instructor
 *      ollama pull mistral:7b     # Evaluators
 *
 * 3. Start Ollama:
 *    Linux/Mac: OLLAMA_GPU_LAYERS=999 ollama serve
 *    Windows: Set env var OLLAMA_GPU_LAYERS=999 then run Ollama.exe
 *    Check: curl http://localhost:11434/api/tags
 *
 * 4. Verify connectivity:
 *    curl http://localhost:11434/v1/chat/completions \
 *      -H "Content-Type: application/json" \
 *      -d '{"model":"gemma2:2b","messages":[{"role":"user","content":"hi"}]}'
 *
 * HARDWARE PROFILE PRESETS:
 * ==========================
 * - "tier-1-budget": RTX 4060 (8GB) or M2/M3 Mac (16GB unified)
 * - "tier-2-workstation": RTX 4090 (24GB) or 2× RTX 3090
 * - "tier-3-server": A100 80GB or H100 80GB
 */
"use strict";
// ============================================================================
// HARDWARE PROFILE CONFIGURATION
// Select ONE profile based on your GPU. Profiles auto-configure model selection
// and threading mode (sequential vs. parallel evaluators).
// ============================================================================
const profiles = {
    "tier-1-budget": {
        // RTX 4060, GTX 1650, M2 MacBook Pro
        description: "Developer Laptop (8-16 GB VRAM)",
        ROUTER_MODEL: "gemma2:2b",
        EVALUATOR_A_MODEL: "phi3.5:mini", // Can also use gemma2:2b for ultra-budget
        EVALUATOR_B_MODEL: "phi3.5:mini", // All share same model in memory
        EVALUATOR_C_MODEL: "phi3.5:mini",
        INSTRUCTOR_MODEL: "phi3.5:mini",
        SEQUENTIAL_EVALUATORS: true, // MUST be true for 8GB VRAM
        EVALUATOR_MAX_TOKENS: 256,
    },
    "tier-2-workstation": {
        // RTX 4090, 2× RTX 3090, Mac Studio
        description: "Workstation (24+ GB VRAM)",
        ROUTER_MODEL: "gemma2:2b",
        EVALUATOR_A_MODEL: "phi4:3.8b", // Can run 3 in parallel
        EVALUATOR_B_MODEL: "phi4:3.8b",
        EVALUATOR_C_MODEL: "phi4:3.8b",
        INSTRUCTOR_MODEL: "gemma2:9b", // Or phi4:14b for better quality
        SEQUENTIAL_EVALUATORS: false, // Can parallelize
        EVALUATOR_MAX_TOKENS: 512,
    },
    "tier-3-server": {
        // A100, H100, enterprise GPU cluster
        description: "Server/Production (80+ GB VRAM)",
        ROUTER_MODEL: "gemma2:2b",
        EVALUATOR_A_MODEL: "mistral:7b", // Proven evaluators
        EVALUATOR_B_MODEL: "mistral:7b",
        EVALUATOR_C_MODEL: "mistral:7b",
        INSTRUCTOR_MODEL: "llama2:70b", // Highest quality
        SEQUENTIAL_EVALUATORS: false,
        EVALUATOR_MAX_TOKENS: 1024,
    },
};
// ============================================================================
// SELECT YOUR HARDWARE PROFILE HERE
// ============================================================================
const ACTIVE_PROFILE = process.env.LLM_HARDWARE_PROFILE || "tier-1-budget";
if (!profiles[ACTIVE_PROFILE]) {
    throw new Error(`Invalid LLM_HARDWARE_PROFILE: ${ACTIVE_PROFILE}. ` +
        `Valid options: ${Object.keys(profiles).join(", ")}`);
}
const profile = profiles[ACTIVE_PROFILE];
module.exports = {
    // ========== ACTIVE PROFILE CONFIG ==========
    PROFILE_NAME: ACTIVE_PROFILE,
    PROFILE_DESCRIPTION: profile.description,
    // ========== CORE SETTINGS ==========
    // Ollama default: http://localhost:11434
    // llama.cpp: http://localhost:8000
    // vLLM: http://localhost:8000
    INFERENCE_URL: process.env.LLM_INFERENCE_URL || "http://localhost:11434/v1/chat/completions",
    // ========== MODEL SELECTION (from profile) ==========
    ROUTER_MODEL: profile.ROUTER_MODEL,
    EVALUATOR_A_MODEL: profile.EVALUATOR_A_MODEL,
    EVALUATOR_B_MODEL: profile.EVALUATOR_B_MODEL,
    EVALUATOR_C_MODEL: profile.EVALUATOR_C_MODEL,
    INSTRUCTOR_MODEL: profile.INSTRUCTOR_MODEL,
    /**
     * Returns the API key (Ollama doesn't use API keys).
     * Kept for API compatibility with cloud functions.
     * @return {string}
     */
    getApiKey: () => process.env.OLLAMA_API_KEY || "ollama",
    // ========== EVALUATION MODE ==========
    // true: Run all 3 evaluators sequentially (fits in 8GB VRAM, ~5s latency)
    // false: Run all 3 evaluators in parallel (needs 24GB+ VRAM, ~1s latency)
    SEQUENTIAL_EVALUATORS: profile.SEQUENTIAL_EVALUATORS,
    // ========== TOKEN LIMITS ==========
    EVALUATOR_MAX_TOKENS: profile.EVALUATOR_MAX_TOKENS,
    INSTRUCTOR_MAX_TOKENS: 1024,
    ROUTER_MAX_TOKENS: 256,
    // ========== LLM PARAMETERS (Temperature, Top-P, etc.) ==========
    // Adjust per-model if needed. Lower temperature = more deterministic.
    GENERATION_PARAMS: {
        router: {
            temperature: 0.1,
            top_p: 0.9,
        },
        evaluators: {
            temperature: 0.2,
            top_p: 0.95,
        },
        instructor: {
            temperature: 0.7,
            top_p: 0.95,
        },
    },
    // ========== AVAILABLE PROFILES (for debugging/switching) ==========
    AVAILABLE_PROFILES: Object.entries(profiles).map(([name, config]) => ({
        name,
        description: config.description,
    })),
};
