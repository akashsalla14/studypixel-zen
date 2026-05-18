# Widget Seeding Guide v2.0
**Comprehensive Guide for Seeding All 11 Widgets to Firestore**

**Last Updated:** May 10, 2026  
**Status:** ✅ Ready for production (includes widgets 9-11)  
**Difficulty:** Easy (copy-paste into Cloud Shell)

---

## Quick Summary

This guide provides **two methods** to seed widgets:
1. **Google Cloud Shell** (recommended, 2 minutes)
2. **Local Node.js** (for development)

All 11 widgets are included:
- ✅ Widgets 1-8: Core assessment & learning
- ✅ Widget 9 (`timeline-v1`): Event sequencing
- ✅ Widget 10 (`spaced-review-v1`): BKT-backed review queue
- ✅ Widget 11 (`analogy-v1`): Conceptual reasoning

---

## Method 1: Google Cloud Shell (Recommended) 🚀

### Prerequisites
- Access to [Google Cloud Console](https://console.cloud.google.com)
- Project ID: `studypixel-9d599`
- Internet connection

### Step 1: Open Cloud Shell

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Select project: **studypixel-9d599**
3. Click **Cloud Shell** icon (top right, looks like `>_`)
4. Wait for terminal to load (30 seconds)

### Step 2: Copy and Paste This Block

**Select all text below and copy (Ctrl+C):**

```bash
cat > seed-widgets.js << 'EOF'
const admin = require("firebase-admin");
const {getFirestore} = require("firebase-admin/firestore");

if (admin.apps.length === 0) {
  admin.initializeApp({projectId: "studypixel-9d599"});
}

const db = getFirestore();

const WIDGETS = [
  {widgetId:"mcq-v1",name:"Multiple Choice Question",description:"Single-answer multiple choice assessment.",category:"assessment",difficulty:"beginner",version:"1.0",required_data_format:{prompt:"string",options:"{[key:string]:string}",correctAnswer:"string"},tags:["assessment","quick","objective"]},
  {widgetId:"mcq-reasoning-v1",name:"MCQ with Reasoning",description:"MCQ requiring explanation of answer.",category:"assessment",difficulty:"intermediate",version:"1.0",required_data_format:{prompt:"string",options:"{[key:string]:string}",correctAnswer:"string",requiresReasoning:"boolean",reasoningPrompt:"string"},tags:["assessment","reasoning","metacognition"]},
  {widgetId:"flashcard-v1",name:"Flashcard",description:"Spaced repetition flashcard for memorization.",category:"memorization",difficulty:"beginner",version:"1.0",required_data_format:{front:"string",back:"string"},tags:["memorization","recall","vocabulary"]},
  {widgetId:"diagram-generator-v1",name:"Diagram Generator",description:"Flowcharts, trees, and conceptual diagrams.",category:"visualization",difficulty:"intermediate",version:"1.0",required_data_format:{type:"string",width:"number",height:"number",nodes:"[{id,x,y,text}]",edges:"[{from,to}]"},tags:["visualization","flowchart"]},
  {widgetId:"signal-comparison-v1",name:"Signal Comparison",description:"Compare code/logs side-by-side to find differences.",category:"analysis",difficulty:"intermediate",version:"1.0",required_data_format:{prompt:"string",signalA:"string",signalB:"string"},tags:["analysis","comparison","debugging"]},
  {widgetId:"tactical-sandbox-v1",name:"Tactical Sandbox",description:"Interactive code editor for coding challenges.",category:"coding",difficulty:"advanced",version:"1.0",required_data_format:{taskPrompt:"string",language:"string",initialCode:"string",validationTest:"string"},tags:["coding","practice","hands-on"],status:"requires-integration",backendDependency:"Code Execution Service"},
  {widgetId:"fill-blank-v1",name:"Fill in the Blank",description:"Complete sentences by filling in missing words.",category:"vocabulary",difficulty:"beginner",version:"1.0",required_data_format:{prompt:"string",sentence:"string",correctAnswers:"[[string]]",hint:"string"},tags:["vocabulary","recall","completion"]},
  {widgetId:"matching-v1",name:"Matching",description:"Match terms to definitions or concepts to examples.",category:"terminology",difficulty:"intermediate",version:"1.0",required_data_format:{prompt:"string",pairs:"[{term:string,definition:string}]"},tags:["terminology","matching","relationships"]},
  {widgetId:"timeline-v1",name:"Timeline Ordering",description:"Arrange events in chronological or logical order.",category:"sequencing",difficulty:"intermediate",version:"1.0",required_data_format:{prompt:"string",events:"[string]",correctOrder:"[number]"},tags:["sequencing","ordering","process"]},
  {widgetId:"spaced-review-v1",name:"Spaced Review Queue",description:"Shows topics ready for spaced repetition (BKT-backed).",category:"review",difficulty:"intermediate",version:"1.0",required_data_format:{topics:"[{name,masteryScore,daysSinceReview,retentionPct,nextDueDate}]"},tags:["review","spaced-repetition","adaptive"],status:"requires-integration",backendDependency:"BKT Engine"},
  {widgetId:"analogy-v1",name:"Analogy Completion",description:"Complete analogies (A:B::C:?) to test conceptual understanding.",category:"reasoning",difficulty:"advanced",version:"1.0",required_data_format:{prompt:"string",termA:"string",termB:"string",termC:"string",correctAnswer:"string",acceptableAnswers:"[string]",explanation:"string",hint:"string"},tags:["reasoning","analogy","transfer"]}
];

const META_TRIGGERS = {
  triggers: ["mcq","multiple choice","question","quiz","test","assessment","reasoning","explain","memorize","flashcard","recall","diagram","visual","flowchart","compare","signal","code","sandbox","blank","fill","match","timeline","sequence","order","review","spaced","analogy","relationship"],
  version: "1.0"
};

async function seed() {
  try {
    let batch = db.batch();
    let count = 0;
    const BATCH_SIZE = 400;

    WIDGETS.forEach((w, i) => {
      const ref = db.collection("widgets").doc(w.widgetId);
      batch.set(ref, {...w, createdAt: new Date()});
      count++;
      if (count >= BATCH_SIZE || i === WIDGETS.length - 1) {
        batch.commit();
        batch = db.batch();
        count = 0;
      }
    });

    const metaRef = db.collection("config").doc("metaTriggers");
    batch.set(metaRef, META_TRIGGERS, {merge: true});
    await batch.commit();

    console.log("✅ All 11 widgets seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error:", err.message);
    process.exit(1);
  }
}

seed();
EOF
npm install firebase-admin > /dev/null 2>&1 && node seed-widgets.js
```

**Now paste it into Cloud Shell (Ctrl+V) and press Enter.**

### Step 3: Wait for Success Message

Expected output:
```
✅ All 11 widgets seeded successfully!
```

### Step 4: Verify in Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select project: `studypixel-9d599`
3. Click **Firestore Database**
4. Expand **widgets** collection
5. Verify you see 11 documents:
   - ✅ `mcq-v1`
   - ✅ `mcq-reasoning-v1`
   - ✅ `flashcard-v1`
   - ✅ `diagram-generator-v1`
   - ✅ `signal-comparison-v1`
   - ✅ `tactical-sandbox-v1`
   - ✅ `fill-blank-v1`
   - ✅ `matching-v1`
   - ✅ `timeline-v1` ← NEW
   - ✅ `spaced-review-v1` ← NEW
   - ✅ `analogy-v1` ← NEW

---

## Method 2: Local Node.js (Development) 💻

For testing locally before Cloud deployment:

### Prerequisites
- Node.js 18+ installed
- Firebase CLI: `npm install -g firebase-tools`
- Authenticated to Firebase: `firebase login`

### Step 1: Copy Improved Seed File

The file `seedWidgets.improved.js` is already in your project at:
```
functions/seedWidgets.improved.js
```

### Step 2: Run Locally

```bash
cd functions
node seedWidgets.improved.js
```

### Step 3: Expected Output

```
🌱 StudyPixel Widget Seeding (v2.0)
=====================================

📝 Seeding 11 widgets...
   ✓ Batch committed (11 operations)

⚙️  Creating configuration documents...
   ✓ Meta-triggers config created
   ✓ Widget validation config created
   ✓ Widget categories created

✅ Verification Report:
   - Total widgets in Firestore: 11
   - Config documents: 3
   - Status: ✅ All widgets seeded

   🔌 Widgets requiring backend integration:
      - tactical-sandbox-v1: Code Execution Service (Judge0 or Cloud Functions)
      - spaced-review-v1: BKT Engine (calculatePosteriorMastery, calculateRetention)

✅ Widget seeding completed successfully!
🚀 Next Steps:
   1. Verify in Firebase Console: https://console.firebase.google.com
   2. Frontend: Implement widget UI components
   3. Integration: Wire BKT for spaced-review-v1
   4. Testing: Use test prompts from WIDGET_TEST_PROMPTS.md
```

---

## What Gets Seeded?

### The 11 Widgets

| # | Widget ID | Name | Category | Status |
|---|-----------|------|----------|--------|
| 1 | `mcq-v1` | Multiple Choice | Assessment | ✅ Ready |
| 2 | `mcq-reasoning-v1` | MCQ + Reasoning | Assessment | ✅ Ready |
| 3 | `flashcard-v1` | Flashcard | Memorization | ✅ Ready |
| 4 | `diagram-generator-v1` | Diagram Generator | Visualization | ✅ Ready |
| 5 | `signal-comparison-v1` | Signal Comparison | Analysis | ✅ Ready |
| 6 | `tactical-sandbox-v1` | Tactical Sandbox | Coding | 🔌 Integration Required |
| 7 | `fill-blank-v1` | Fill in the Blank | Vocabulary | ✅ Ready |
| 8 | `matching-v1` | Matching | Terminology | ✅ Ready |
| 9 | `timeline-v1` | Timeline Ordering | Sequencing | ✅ Routed |
| 10 | `spaced-review-v1` | Spaced Review | Review | ✅ Routed |
| 11 | `analogy-v1` | Analogy Completion | Reasoning | ✅ Routed |

### Additional Configurations

**Three config documents are created:**

1. **`config/metaTriggers`** — Keywords for intent classification
   - Used by `classifyIntent()` in backend
   - Detects widget requests ("match", "timeline", "flashcard", etc.)

2. **`config/widgetValidation`** — Rules for payload validation
   - Required fields per widget
   - Max payload size: 50KB
   - Timeout: 30 seconds

3. **`config/widgetCategories`** — UI categories and colors
   - Groups widgets by type
   - Provides icons and colors for frontend

---

## Widgets Requiring Integration

### Widget 9: `tactical-sandbox-v1`
**Status:** Metadata seeded ✅ | Backend integration needed 🔌

**What's missing:**
- Code execution service (currently returns placeholder)
- Judge0 API integration or Cloud Functions executor
- Output validation and error handling

**Integration checklist:**
```
[ ] Set up Judge0 account or use Cloud Functions
[ ] Add code execution handler in runTeachingAgent()
[ ] Implement output parsing and validation
[ ] Add security sandbox constraints
[ ] Test with Python/JavaScript/Bash challenges
```

### Widget 10: `spaced-review-v1`
**Status:** Metadata seeded ✅ | BKT backend wiring needed 🔌

**What's missing:**
- Backend call to `calculateRetention()` and `calculatePosteriorMastery()`
- Student mastery profile fetching
- Sorting by urgency (low retention + old review = high priority)
- Firestore query for topics ready for review

**Integration checklist:**
```
[ ] Fetch student's BKT profile from Firestore
[ ] Calculate retention for each topic using Ebbinghaus formula
[ ] Sort by: (1-retentionPct) * days_since_review
[ ] Return top 5-10 topics
[ ] Wire into evaluateWithCouncil() post-assessment
```

### Widget 11: `analogy-v1`
**Status:** Metadata seeded ✅ | Ready to use ✅

**No additional integration needed.**

---

## Testing the Seeding

### Quick Test 1: Verify Widget Exists

```javascript
// In your browser console at https://console.firebase.google.com:
db.collection("widgets").doc("timeline-v1").get().then(doc => {
  console.log(doc.data());
});
```

Expected output:
```json
{
  "widgetId": "timeline-v1",
  "name": "Timeline Ordering",
  "category": "sequencing",
  "required_data_format": {
    "prompt": "string",
    "events": "[string]",
    "correctOrder": "[number]"
  }
}
```

### Quick Test 2: Use in Backend

Add this to `index.js` to confirm widgets are cached:

```javascript
// After cache loads
console.log("Cached widgets:", cachedWidgets.map(w => w.widgetId));
// Expected: ["mcq-v1", "mcq-reasoning-v1", ..., "timeline-v1", "spaced-review-v1", "analogy-v1"]
```

### Quick Test 3: Test Widget Selection

Send this prompt to trigger widget 9:

```
Create a timeline exercise: Order these cybersecurity milestones chronologically:
- 1983: TCP/IP protocol standardized
- 2011: SSL 3.0 deprecated
- 2016: Let's Encrypt launched free SSL
- 2014: Heartbleed vulnerability discovered
- 2022: SHA-1 sunset

Correct order: 1983 → 2014 → 2016 → 2011 → 2022
```

Expected backend response:
```json
{
  "action": "USE_WIDGET",
  "mentor_speech": "Great! Let's test your knowledge of security history...",
  "widgetId": "timeline-v1",
  "widgetData": {
    "prompt": "Order these cybersecurity milestones chronologically",
    "events": ["TCP/IP 1983", "Heartbleed 2014", ...],
    "correctOrder": [0, 3, 1, 2, 4]
  }
}
```

---

## Troubleshooting

### Error: "Not found; Gaia id not found"
**Cause:** Trying to run in Cloud Shell without authentication  
**Solution:**
```bash
gcloud auth application-default login
firebase init
```

### Error: "Permission denied"
**Cause:** Firestore rules block write operation  
**Solution:** Check Firebase rules allow writes to `widgets` collection:
```javascript
// In Firestore Rules editor:
match /widgets/{document=**} {
  allow read: if true;  // Public read
  allow write: if request.auth != null || request.headers['Authorization'] != null;
}
```

### Error: "Batch operation size too large"
**Cause:** Script tried to batch 500+ operations  
**Solution:** Already handled in `seedWidgets.improved.js` (batches of 400)

### Widgets don't appear in cache
**Cause:** Cache hasn't refreshed (TTL = 10 minutes)  
**Solution:**
```javascript
// Force cache refresh in backend
cachedWidgets = null;
cachedWidgetsExpiry = 0;

// Next evaluateWithCouncil() will reload
```

### Widget appears in Firestore but not in app
**Cause:** Frontend switch statement doesn't have this widget ID  
**Solution:** Add to `PixelBotWorkspace.js`:
```javascript
case "timeline-v1":
  return <TimelineWidget data={widgetData} />;
case "spaced-review-v1":
  return <SpacedReviewWidget data={widgetData} />;
case "analogy-v1":
  return <AnalogyWidget data={widgetData} />;
```

---

## Next Steps After Seeding

### Phase 2A: Frontend Widget Components (Complete)

You need to implement these React components:
```
studypixel/src/components/widgets/
├─ TimelineWidget.js          ← Implemented and routed
├─ AnalogyWidget.js           ← Implemented and routed
├─ SpacedReviewWidget.js      ← Implemented and routed
├─ ImageAnalysisWidget.js     ← Implemented and routed
├─ [other widgets already exist]
└─ WidgetFactory.js           ← Already routes widgets
```

### Phase 2B: Backend Integration (After Frontend)

Wire these features:
```
1. tactical-sandbox-v1:
   └─ Add code execution handler (Judge0 API)
   
2. spaced-review-v1:
   └─ Integrate BKT engine in runTeachingAgent()
   └─ Fetch student profile, calculate retention
   └─ Sort by urgency
```

### Phase 3: Testing & Refinement

Use the test prompts in `WIDGET_TEST_PROMPTS.md` to validate each widget.

---

## Reference: Widget Data Structures

### Timeline-V1 Example

**Backend generates:**
```json
{
  "action": "USE_WIDGET",
  "widgetId": "timeline-v1",
  "widgetData": {
    "prompt": "Arrange in the correct incident response order",
    "events": [
      "Eradicate the threat",
      "Detect the incident",
      "Recover to normal ops",
      "Contain the breach"
    ],
    "correctOrder": [1, 3, 0, 2]
  }
}
```

**Frontend displays:**
- Shuffled event cards
- Drag-drop into correct order
- Submit for validation

---

### Spaced-Review-V1 Example

**Backend generates (post-BKT integration):**
```json
{
  "action": "USE_WIDGET",
  "widgetId": "spaced-review-v1",
  "widgetData": {
    "topics": [
      {
        "name": "XSS Vulnerabilities",
        "masteryScore": 0.60,
        "daysSinceReview": 7,
        "retentionPct": 65,
        "nextDueDate": "2026-05-08"
      },
      {
        "name": "SQL Injection",
        "masteryScore": 0.85,
        "daysSinceReview": 3,
        "retentionPct": 88,
        "nextDueDate": "2026-05-09"
      }
    ]
  }
}
```

**Frontend displays:**
- List sorted by urgency
- "Review Now" button per topic
- Progress indicators

---

### Analogy-V1 Example

**Backend generates:**
```json
{
  "action": "USE_WIDGET",
  "widgetId": "analogy-v1",
  "widgetData": {
    "prompt": "Complete the analogy",
    "termA": "Encryption",
    "termB": "Confidentiality",
    "termC": "Hash Functions",
    "correctAnswer": "Data Integrity",
    "explanation": "Just as encryption provides confidentiality, hash functions provide integrity.",
    "hint": "Think about security properties...",
    "acceptableAnswers": ["Data Integrity", "integrity", "message integrity"]
  }
}
```

**Frontend displays:**
- Analogy statement: "Encryption is to Confidentiality as Hash Functions is to ___"
- Text input for answer
- Hint button
- Feedback after submission

---

## Support

For issues or questions:
- Check [Firebase Docs](https://firebase.google.com/docs/firestore)
- Review [CloudShell Guide](https://cloud.google.com/shell/docs)
- Contact: [Your Support Channel]

---

**Version History:**
- v1.0 (May 6) — Initial guide for 8 widgets
- v2.0 (May 10) — Added widgets 9-11, improved seed script, integration docs

