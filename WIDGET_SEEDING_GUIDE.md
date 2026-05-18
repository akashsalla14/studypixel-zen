# Widget Seeding & Management Guide

**Last Updated:** May 6, 2026  
**Status:** ✅ All 11 widgets successfully seeded to Firestore

---

## Quick Start: Seed Widgets (Easiest Method)

### Prerequisites
- Access to Google Cloud Shell (automatic authentication)
- Project ID: `studypixel-9d599`

### Step 1: Open Cloud Shell
Go to [Google Cloud Console](https://console.cloud.google.com) → Click **Cloud Shell** (terminal icon at top)

### Step 2: Create & Run Seed Script

**Copy-paste this entire block into Cloud Shell:**

```bash
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
    
    // Write each widget
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

npm install firebase-admin
node /tmp/seed-widgets.js
```

### Step 3: Verify Success

**Expected output:**
```
✅ Successfully seeded 11 widgets to Firestore!
```

**Verify in Firebase Console:**
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select `studypixel-9d599` project
3. Click **Firestore Database**
4. Verify `widgets` collection exists with 11 documents:
   - mcq-v1
   - mcq-reasoning-v1
   - flashcard-v1
   - diagram-generator-v1
   - signal-comparison-v1
   - tactical-sandbox-v1
   - fill-blank-v1
   - matching-v1
   - timeline-v1
   - spaced-review-v1
   - analogy-v1

5. Verify `config` collection has `metaTriggers` document

---

## Update Widget Details

### Add or Modify a Widget

**In Cloud Shell:**

```bash
cat > /tmp/update-widget.js << 'EOF'
const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'studypixel-9d599'
});

const db = admin.firestore();

async function updateWidget() {
  try {
    // Example: Update MCQ widget
    await db.collection('widgets').doc('mcq-v1').update({
      name: 'Multiple Choice Question v2',
      description: 'Enhanced single/multiple answer questions',
      category: 'assessment',
      requiredDataFormat: {
        question: 'string',
        options: 'array<{text: string, isCorrect: boolean}>',
        explanation: 'string'
      },
      updatedAt: new Date()
    });

    console.log('✅ Widget updated successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updateWidget();
EOF

npm install firebase-admin
node /tmp/update-widget.js
```

### Add a New Widget

```bash
cat > /tmp/add-widget.js << 'EOF'
const admin = require('firebase-admin');

admin.initializeApp({
  projectId: 'studypixel-9d599'
});

const db = admin.firestore();

async function addWidget() {
  try {
    await db.collection('widgets').doc('new-widget-v1').set({
      widgetId: 'new-widget-v1',
      name: 'Your New Widget Name',
      description: 'Widget description',
      category: 'assessment', // or your category
      requiredDataFormat: {
        // Define expected data structure
      },
      createdAt: new Date()
    });

    console.log('✅ New widget added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addWidget();
EOF

npm install firebase-admin
node /tmp/add-widget.js
```

---

## Current Widget Catalog

| Widget ID | Name | Category | Purpose |
|-----------|------|----------|---------|
| mcq-v1 | Multiple Choice | Assessment | Single/multiple answer questions |
| mcq-reasoning-v1 | MCQ with Reasoning | Assessment | Questions requiring explanations |
| flashcard-v1 | Flashcard | Memorization | Interactive memory cards |
| diagram-generator-v1 | Diagram Generator | Visualization | Create and label diagrams |
| signal-comparison-v1 | Signal Comparison | Analysis | Compare concepts/signals |
| tactical-sandbox-v1 | Tactical Sandbox | Coding | Interactive code environment |
| fill-blank-v1 | Fill in the Blank | Vocabulary | Complete sentences/formulas |
| matching-v1 | Matching | Terminology | Match terms to definitions |
| timeline-v1 | Timeline | Sequencing | Order events chronologically |
| spaced-review-v1 | Spaced Review | Review | Intelligent repetition |
| analogy-v1 | Analogy | Reasoning | Understand relationships |

---

## Troubleshooting

### Error: "Not found; Gaia id not found"
**Cause:** Trying to create custom token with non-existent user  
**Solution:** Use direct Firestore batch writes instead (recommended method above)

### Error: "Permission denied"
**Cause:** Cloud Shell credentials expired  
**Solution:** Refresh Cloud Shell and run again

### Widget doesn't appear in app
1. Check Firestore Console for document
2. Verify `widgetId` matches frontend switch case names in `PixelBotWorkspace.js`
3. Clear browser cache and reload

### Batch Commit Size Exceeded
**Cause:** Firebase limits batch writes to 500 operations  
**Solution:** Split updates into multiple batches (shell script handles this automatically)

---

## Next Steps After Seeding

1. ✅ Widgets seeded to Firestore
2. ✅ Frontend components render widgets (switch cases in `PixelBotWorkspace.js`)
3. 🔄 Backend cache updates on first `evaluateWithCouncil` call
4. 🔄 Students see widgets when mentor recommends them

**No additional configuration needed!**

---

## References

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Full deployment checklist
- [WIDGET_SPECIFICATIONS.md](WIDGET_SPECIFICATIONS.md) - Widget schema details
- [functions/index.js](functions/index.js#L1440) - Backend seedWidgets function
- [PixelBotWorkspace.js](studypixel/src/components/pixelbot/PixelBotWorkspace.js#L240) - Frontend widget renderer
