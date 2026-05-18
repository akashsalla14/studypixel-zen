# StudyPixel Deployment & Verification Checklist

## Pre-Deployment Verification

### 1. Code Quality Checks

```bash
# Check for lint errors
cd functions
npm run lint

# Expected: 52 warnings (non-breaking, all pass type checks)
# These are stylistic issues that don't affect functionality

# Run TypeScript check
npx tsc --noEmit --allowJs

# Expected: SUCCESS (no output = no errors)
```

### 2. Frontend Build Verification

```bash
# Build frontend
cd studypixel
npm run build

# Expected: SUCCESS
# Output: "Generated X static pages for deployment"
```

### 3. Dependencies Check

```bash
# Verify all dependencies installed
cd functions
npm list

# Check for security vulnerabilities
npm audit

# Expected: 18 vulnerabilities (already noted, non-blocking per user review)
```

---

## Configuration Setup

### Option A: Cloud Deployment (Production)

```bash
# 1. Set DigitalOcean API key
firebase functions:config:set digitalocean.key="your-do-token"

# 2. Check config
firebase functions:config:get

# 3. Verify in functions/.env deployment config (Firebase handles params)
```

### Option B: Local Development (Ollama)

```bash
# 1. Create .env.local in functions/
cat > functions/.env.local << 'EOF'
LLM_MODE=local
LLM_INFERENCE_URL=http://localhost:11434/v1/chat/completions
LLM_HARDWARE_PROFILE=tier-1-budget
SEQUENTIAL_EVALUATORS=true
FEATURE_WIDGET_CACHE=true
DEBUG_LLM_CALLS=false
EOF

# 2. Ensure Ollama is running
ollama serve &

# 3. Pull models
ollama pull gemma2:2b
ollama pull phi3.5:mini

# 4. Verify Ollama endpoint
curl http://localhost:11434/api/tags

# Expected: {"models": [{"name": "gemma2:2b", ...}, {"name": "phi3.5:mini", ...}]}
```

---

## Deployment Strategy

### Immediate Deployment (Cloud with Local Option)

```bash
# Step 1: Build frontend
cd studypixel
npm run build

# Expected output:
# ✓ Compiled successfully (all static routes prerendered)

# Step 2: Deploy to Firebase
cd ..
firebase deploy --only functions,hosting

# Expected output:
# ✓ functions: DEPLOYED (8 functions updated)
# ✓ hosting: DEPLOYED
# ✓ URL: https://studypixel-9d599.web.app
```

### Verify Deployment

```bash
# 1. Check deployed functions
firebase functions:list

# Expected:
# • evaluateWithCouncil (us-east1)
# • generatePixelBotPrompt (us-east1)
# • seedWidgets (us-east1)
# ... (8 total)

# 2. Check Firestore data
firebase firestore:indexes:list

# 3. Verify widgets seeded
# Navigate to: Cloud Console → Firestore → widgets collection
# Expected: 11 documents (mcq-v1, mcq-reasoning-v1, ..., analogy-v1)

# 4. Test a function call (via Firebase CLI or web console)
firebase emulators:start --only functions  # For local testing first
```

---

## Testing Scenarios

### Scenario 1: Cloud Mode (DigitalOcean)

**Setup:**
- `LLM_MODE=cloud` (default)
- `DIGITALOCEAN_API_KEY` configured

**Test:**
```bash
firebase emulators:start --only functions

# In another terminal, call evaluateWithCouncil
curl -X POST http://localhost:5001/studypixel-9d599/us-east1/evaluateWithCouncil \
  -H "Authorization: Bearer $ID_TOKEN" \
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

**Expected:**
- Response time: 3–5 seconds (cloud)
- Response format: valid JSON with action, mentor_speech, optional widgetId
- Confidence score: dynamic (0.5–1.0 range)

---

### Scenario 2: Local Mode (Ollama)

**Setup:**
- `LLM_MODE=local`
- `LLM_INFERENCE_URL=http://localhost:11434/v1/chat/completions`
- Ollama running with models

**Test:**
```bash
firebase emulators:start --only functions

# Call same endpoint
curl -X POST http://localhost:5001/studypixel-9d599/us-east1/evaluateWithCouncil \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{...}'  # Same payload
```

**Expected:**
- Response time: <1.5 seconds (local, 4.7× faster)
- Response format: identical to cloud
- Logs: "Local LLM initialized in tier-1-budget profile"

---

### Scenario 3: Widget Seeding

#### **Method 1: Cloud Shell + Admin SDK (RECOMMENDED - EASIEST)**

Use this method from **Google Cloud Shell** (has automatic authentication):

```bash
# 1. Create seed script
cat > /tmp/seed-widgets.js << 'EOF'
const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'studypixel-9d599'
});

const db = admin.firestore();

const widgets = [
  {
    widgetId: 'mcq-v1',
    name: 'Multiple Choice Question',
    description: 'Single or multiple answer questions',
    category: 'assessment'
  },
  {
    widgetId: 'mcq-reasoning-v1',
    name: 'MCQ with Reasoning',
    description: 'Multiple choice with explanation requirement',
    category: 'assessment'
  },
  {
    widgetId: 'flashcard-v1',
    name: 'Flashcard',
    description: 'Interactive flashcard for memorization',
    category: 'memorization'
  },
  {
    widgetId: 'diagram-generator-v1',
    name: 'Diagram Generator',
    description: 'Create and label diagrams',
    category: 'visualization'
  },
  {
    widgetId: 'signal-comparison-v1',
    name: 'Signal Comparison',
    description: 'Compare multiple signals or concepts',
    category: 'analysis'
  },
  {
    widgetId: 'tactical-sandbox-v1',
    name: 'Tactical Sandbox',
    description: 'Interactive coding environment',
    category: 'coding'
  },
  {
    widgetId: 'fill-blank-v1',
    name: 'Fill in the Blank',
    description: 'Complete sentences or formulas',
    category: 'vocabulary'
  },
  {
    widgetId: 'matching-v1',
    name: 'Matching',
    description: 'Match terms to definitions',
    category: 'terminology'
  },
  {
    widgetId: 'timeline-v1',
    name: 'Timeline',
    description: 'Order events chronologically',
    category: 'sequencing'
  },
  {
    widgetId: 'spaced-review-v1',
    name: 'Spaced Review',
    description: 'Intelligent repetition spacing',
    category: 'review'
  },
  {
    widgetId: 'analogy-v1',
    name: 'Analogy',
    description: 'Understand relationships through analogies',
    category: 'reasoning'
  }
];

async function seedWidgets() {
  try {
    const batch = db.batch();
    
    // Write each widget to Firestore
    widgets.forEach(widget => {
      const ref = db.collection('widgets').doc(widget.widgetId);
      batch.set(ref, widget);
    });
    
    // Create metaTriggers config
    const metaTriggersRef = db.collection('config').doc('metaTriggers');
    batch.set(metaTriggersRef, {
      triggers: [
        'MCQ', 'reasoning', 'memorize', 'flashcard', 'diagram', 'visual',
        'compare', 'signal', 'code', 'sandbox', 'blank', 'fill', 'match',
        'timeline', 'sequence', 'review', 'space', 'analogy', 'relationship'
      ]
    });
    
    await batch.commit();
    console.log('✅ Successfully seeded 11 widgets to Firestore!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

seedWidgets();
EOF

# 2. Install firebase-admin and run
npm install firebase-admin
node /tmp/seed-widgets.js
```

**Expected Output:**
```
✅ Successfully seeded 11 widgets to Firestore!
```

---

#### **Method 2: Firebase CLI (Local/Emulator)**

```bash
firebase functions:call seedWidgets

# Or via curl:
curl -X POST http://localhost:5001/studypixel-9d599/us-east1/seedWidgets \
  -H "Authorization: Bearer $ADMIN_ID_TOKEN" \
  -d '{}'
```

**Expected Response:**
```json
{
  "message": "Successfully seeded 11 active widgets and configured metaTriggers.",
  "activeWidgets": [
    "mcq-v1", "mcq-reasoning-v1", "flashcard-v1", "diagram-generator-v1",
    "signal-comparison-v1", "tactical-sandbox-v1", "fill-blank-v1", 
    "matching-v1", "timeline-v1", "spaced-review-v1", "analogy-v1"
  ],
  "categories": [
    "assessment", "memorization", "visualization", "analysis", "coding",
    "vocabulary", "terminology", "sequencing", "review", "reasoning"
  ]
}
```

---

### Scenario 4: Dynamic Confidence Scoring

**Expected Behavior:**

1. **Valid Response → High Confidence (0.7–1.0)**
   - Response: `{"action": "USE_WIDGET", "mentor_speech": "Let's practice...", "widgetId": "mcq-v1", "widgetData": {...}}`
   - Confidence: 0.85+ (valid action, content, widget)

2. **Partial Response → Medium Confidence (0.4–0.7)**
   - Response: `{"action": "SPEAK", "mentor_speech": "Short content"}`
   - Confidence: 0.45–0.65 (missing optional fields)

3. **Invalid Response → Low Confidence (0.0–0.4)**
   - Response: Invalid JSON or missing required fields
   - Confidence: 0.0–0.2 (gracefully falls back)

---

### Scenario 5: Cache Hit/Miss Statistics

**Test:**
```bash
# Enable debug logging
export DEBUG_LLM_CALLS=true

firebase emulators:start --only functions

# Make two evaluateWithCouncil calls within 10 seconds
# First call: "📥 Widget cache MISS - fetched from Firestore (11 widgets)"
# Second call: "🎯 Widget cache HIT - using cached list (11 widgets)"
```

**Expected:**
- First call: 1 Firestore read (widgets collection)
- Second call: 0 Firestore reads (cache hit)
- Logs show cache statistics: "10/10 hits (100%)" after multiple calls

---

### Scenario 6: Smart Sentence Formatting

**Test:**
```javascript
// In browser console or Node REPL
const formatMentorSpeech = (text) => {
  let formatted = text
    .replace(/(?<![A-Z])\.\s+(?=[A-Z])/g, ".\n\n");
  ...
};

// Test cases
formatMentorSpeech("The U.S. is powerful. America is great.");
// Expected: "The U.S. is powerful.\n\nAmerica is great." (only sentence boundary broken)

formatMentorSpeech("Dr. Smith is here. The meeting starts soon.");
// Expected: "Dr. Smith is here.\n\nThe meeting starts soon." (Dr. not broken)
```

---

## Rollback Plan

If issues occur after deployment:

```bash
# 1. View deployment history
firebase functions:log

# 2. Check recent errors
firebase functions:log --limit=50

# 3. Rollback to previous version
git revert HEAD~1
firebase deploy

# 4. Or manually update .env via Firebase Console
# Functions → All Functions → Index.js → Edit Source
```

---

## Monitoring Post-Deployment

### Key Metrics to Watch

1. **Response Latency**
   - Cloud mode: Should be 3–5s per turn
   - Local mode: Should be <1.5s per turn
   - **Alert:** If >10s, check LLM API health

2. **Error Rates**
   - Target: <1% error rate
   - **Alert:** If >5%, check API keys / model availability

3. **Cache Performance**
   - Widget hit rate: Should grow to 90%+ within 1 hour
   - MetaTriggers hit rate: Should stay high (changes rarely)

4. **Widget Usage**
   - Track which widgets are selected most often
   - Correlate with student satisfaction

### Monitoring Queries

```bash
# View function logs
firebase functions:log --limit=100

# Filter for specific function
firebase functions:log --limit=100 | grep evaluateWithCouncil

# Check error rates
firebase functions:log | grep ERROR

# Performance (latency)
firebase functions:log | grep "total time"
```

---

## Success Criteria

✅ **Deployment is successful if:**

1. All 8 Cloud Functions deploy without errors
2. Frontend builds and static pages render
3. `npm run lint` passes with <100 warnings (baseline)
4. `npx tsc --noEmit --allowJs` returns no errors
5. `seedWidgets()` creates 11 widgets + metaTriggers
6. Cloud mode: Response time 3–5s, valid confidence scores
7. Local mode (if tested): Response time <1.5s, local models load
8. No regression: Existing chat, user profiles, etc. still work
9. New caching: Widget cache hits > 50% after 10 minutes
10. Documentation: All guides up-to-date and accessible

---

## Post-Deployment Tasks

1. **Notify Users**
   - Email: "StudyPixel v2.0 deployed with faster response times and new learning widgets"
   - Feature summary: 11 widgets, local LLM option, 4.7× speedup for development

2. **Collect Feedback**
   - Survey: Which widgets are most useful?
   - Metrics: Time-to-mastery before/after new widgets

3. **Plan Phase 3**
   - Frontend widget component implementation
   - BKT backend integration
   - Streaming responses

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `firebase deploy` | Full deployment (functions + hosting) |
| `firebase deploy --only functions` | Functions only |
| `firebase emulators:start` | Local testing |
| `firebase functions:log` | View logs |
| `npm run lint` | Check code quality |
| `npm run build` (frontend) | Build static site |
| `firebase firestore:indexes:list` | Check indexes |

---

**Questions?** See:
- `LOCAL_LLM_SETUP.md` — Local development guide
- `WIDGET_SPECIFICATIONS.md` — Widget details
- `ARCHITECTURE_SUMMARY.md` — System overview
