"use strict";
/**
 * @fileoverview StudyPixel Widget Seeding Script (v2.0)
 *
 * Comprehensive seed script for all 11 widgets + configuration.
 * Designed for both local development and Google Cloud Shell execution.
 *
 * USAGE:
 * ------
 * Local:       node seedWidgets.improved.js
 * Cloud Shell: npm install firebase-admin && node seedWidgets.improved.js
 *
 * FEATURES:
 * ---------
 * ✅ Seeds all 11 widgets with complete metadata
 * ✅ Creates validation rules for each widget
 * ✅ Sets up meta-triggers for intent classification
 * ✅ Adds widget difficulty levels and learning outcomes
 * ✅ Includes error recovery and batch optimization
 * ✅ Generates success report with counts
 */
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
// Initialize Firebase Admin (auto-detects Cloud Shell credentials)
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: "studypixel-9d599"
    });
}
const db = getFirestore();
const PROJECT_ID = "studypixel-9d599";
const BATCH_SIZE = 400; // Firebase limit is 500
/**
 * Complete widget definitions with full metadata
 */
const WIDGETS = [
    // ============= PHASE 1: CORE ASSESSMENT WIDGETS =============
    {
        widgetId: "mcq-v1",
        name: "Multiple Choice Question",
        description: "Single-answer multiple choice. Tracks hesitation and time-to-answer telemetry.",
        category: "assessment",
        difficulty: "beginner",
        version: "1.0",
        required_data_format: {
            prompt: "string", // Question text
            options: "{ [key: string]: string }", // Key-value pairs (e.g., "A": "Option text")
            correctAnswer: "string" // Which key is correct (e.g., "B")
        },
        validation_rules: {
            minOptions: 2,
            maxOptions: 8,
            mustHaveCorrectAnswer: true,
            promptMaxLength: 500,
            optionMaxLength: 200
        },
        tags: ["assessment", "quick", "objective", "checkpoint"],
        learningOutcomes: ["Recall", "Comprehension"],
        estimatedTime: "30 seconds",
        estimatedDifficulty: 1
    },
    {
        widgetId: "mcq-reasoning-v1",
        name: "MCQ with Reasoning",
        description: "MCQ requiring written reasoning. Evaluates epistemic confidence and behavioral volatility. MUST set 'requiresReasoning': true.",
        category: "assessment",
        difficulty: "intermediate",
        version: "1.0",
        required_data_format: {
            prompt: "string",
            options: "{ [key: string]: string }",
            correctAnswer: "string",
            requiresReasoning: "boolean (must be true)",
            reasoningPrompt: "string (optional)"
        },
        validation_rules: {
            minOptions: 2,
            maxOptions: 6,
            mustHaveCorrectAnswer: true,
            requiresReasoningField: true,
            reasoningMinLength: 10
        },
        tags: ["assessment", "reasoning", "metacognition", "deeper-learning"],
        learningOutcomes: ["Comprehension", "Analysis", "Evaluation"],
        estimatedTime: "90 seconds",
        estimatedDifficulty: 2
    },
    // ============= PHASE 1: MEMORIZATION & RECALL =============
    {
        widgetId: "flashcard-v1",
        name: "Flashcard",
        description: "Spaced repetition flashcard for recall. Updates BKT engine via self-assessed difficulty metrics.",
        category: "memorization",
        difficulty: "beginner",
        version: "1.0",
        required_data_format: {
            front: "string (question or prompt)",
            back: "string (answer or definition)"
        },
        validation_rules: {
            frontMaxLength: 200,
            backMaxLength: 500,
            mustHaveFront: true,
            mustHaveBack: true
        },
        tags: ["memorization", "recall", "vocabulary", "spaced-repetition"],
        learningOutcomes: ["Recall", "Retention"],
        estimatedTime: "20 seconds per card",
        estimatedDifficulty: 1
    },
    // ============= PHASE 1: VISUALIZATION & ANALYSIS =============
    {
        widgetId: "diagram-generator-v1",
        name: "Diagram Generator",
        description: "Dynamic SVG diagram generator. Supports auto-layout geometry. Provide ONLY a 'labels' array.",
        category: "visualization",
        difficulty: "intermediate",
        version: "1.0",
        required_data_format: {
            type: "string (flowchart|triangle|rectangle|tree)",
            labels: "[string] (fallback if no nodes/edges)",
            prompt: "string"
        },
        validation_rules: {
            typeAllowed: ["flowchart", "triangle", "rectangle", "tree"],
            requiresLabels: true
        },
        tags: ["visualization", "flowchart", "conceptual", "architecture"],
        learningOutcomes: ["Understanding", "Systems Thinking"],
        estimatedTime: "120 seconds",
        estimatedDifficulty: 2
    },
    {
        widgetId: "signal-comparison-v1",
        name: "Signal Comparison",
        description: "Compare two signals/code side-by-side. Tracks inspection time, hesitation, and differential highlighting.",
        category: "analysis",
        difficulty: "intermediate",
        version: "1.0",
        required_data_format: {
            prompt: "string (what to compare for)",
            signalA: "string (code/log/text block A)",
            signalB: "string (code/log/text block B)"
        },
        validation_rules: {
            promptMaxLength: 200,
            signalMaxLength: 1000,
            mustHaveBothSignals: true
        },
        tags: ["analysis", "comparison", "debugging", "security"],
        learningOutcomes: ["Analysis", "Critical Thinking"],
        estimatedTime: "60 seconds",
        estimatedDifficulty: 2
    },
    // ============= PHASE 1: INTERACTIVE PRACTICE =============
    {
        widgetId: "tactical-sandbox-v1",
        name: "Tactical Sandbox",
        description: "Interactive coding challenge. Executes code securely in backend sandbox containers.",
        category: "coding",
        difficulty: "advanced",
        version: "1.0",
        required_data_format: {
            taskPrompt: "string (coding challenge description)",
            language: "string (python|javascript|bash|java)",
            initialCode: "string (starter template)",
            validationTest: "string (test case or assertion)"
        },
        validation_rules: {
            languageAllowed: ["python", "javascript", "bash", "java"],
            taskPromptMaxLength: 500,
            initialCodeMaxLength: 2000,
            requiresBackendIntegration: true
        },
        tags: ["coding", "practice", "hands-on", "advanced"],
        learningOutcomes: ["Application", "Analysis"],
        estimatedTime: "300+ seconds",
        estimatedDifficulty: 3,
        backendDependency: "Code Execution Service (Judge0 or Cloud Functions)",
        status: "requires-integration"
    },
    // ============= PHASE 1: VOCABULARY & COMPLETION =============
    {
        widgetId: "fill-blank-v1",
        name: "Fill in the Blank",
        description: "Complete sentences with [BLANK]. Evaluates vocabulary with case-insensitive canonicalization.",
        category: "vocabulary",
        difficulty: "beginner",
        version: "1.0",
        required_data_format: {
            prompt: "string (instruction text)",
            sentence: "string (text with [BLANK] markers)",
            correctAnswers: "[[string]] (array of acceptable answer sets)",
            hint: "string (optional hint text)"
        },
        validation_rules: {
            sentenceMaxLength: 300,
            blankCount: "1-5",
            correctAnswersRequired: true,
            caseInsensitiveMatch: true
        },
        tags: ["vocabulary", "recall", "completion", "beginner-friendly"],
        learningOutcomes: ["Recall", "Comprehension"],
        estimatedTime: "45 seconds",
        estimatedDifficulty: 1
    },
    {
        widgetId: "matching-v1",
        name: "Matching",
        description: "Match terms to definitions. Tracks deselection volatility and hesitation intervals.",
        category: "terminology",
        difficulty: "intermediate",
        version: "1.0",
        required_data_format: {
            prompt: "string (instruction text)",
            pairs: "[{term: string, definition: string}] (3-6 pairs recommended)"
        },
        validation_rules: {
            pairCountMin: 3,
            pairCountMax: 8,
            termMaxLength: 100,
            definitionMaxLength: 200,
            allPairsMustBeUnique: true
        },
        tags: ["terminology", "matching", "relationships", "visual"],
        learningOutcomes: ["Recall", "Comprehension"],
        estimatedTime: "90 seconds",
        estimatedDifficulty: 2
    },
    // ============= PHASE 1: SEQUENCING & ORDERING =============
    {
        widgetId: "timeline-v1",
        name: "Timeline Ordering",
        description: "Drag-and-drop chronological sequencing. Tracks interaction trace and move count.",
        category: "sequencing",
        difficulty: "intermediate",
        version: "1.0",
        required_data_format: {
            prompt: "string (what order is needed)",
            events: "[string] (3-7 event names, shuffled)",
            correctOrder: "[number] (indices of events in correct order)"
        },
        validation_rules: {
            eventCountMin: 3,
            eventCountMax: 7,
            eventTextMaxLength: 100,
            correctOrderMustBeArray: true,
            lengthMustMatchEventsLength: true
        },
        tags: ["sequencing", "ordering", "process", "logic"],
        learningOutcomes: ["Understanding", "Analysis"],
        estimatedTime: "60 seconds",
        estimatedDifficulty: 2
    },
    // ============= PHASE 2: ADAPTIVE LEARNING (BKT-BACKED) =============
    {
        widgetId: "spaced-review-v1",
        name: "Spaced Review Queue",
        description: "BKT-backed retention queue. Surfaces dynamically decaying topics for personalized review.",
        category: "review",
        difficulty: "intermediate",
        version: "1.0",
        required_data_format: {
            topics: "[{name: string, masteryScore: number, daysSinceReview: number, retentionPct: number, nextDueDate: string}]"
        },
        validation_rules: {
            masteryScoreRange: [0, 1],
            retentionPctRange: [0, 100],
            topicsMinCount: 1,
            topicsMaxCount: 10,
            requiresBKTBackend: true
        },
        tags: ["review", "spaced-repetition", "adaptive", "bkt"],
        learningOutcomes: ["Retention", "Long-term Memory"],
        estimatedTime: "varies",
        estimatedDifficulty: 2,
        backendDependency: "BKT Engine (calculatePosteriorMastery, calculateRetention)",
        status: "requires-integration"
    },
    // ============= PHASE 2: REASONING & ANALOGY =============
    {
        widgetId: "analogy-v1",
        name: "Analogy Completion",
        description: "A is to B as C is to ?. Analyzes reasoning transfer and conceptual mapping.",
        category: "reasoning",
        difficulty: "advanced",
        version: "1.0",
        required_data_format: {
            prompt: "string (instruction text)",
            termA: "string (first term)",
            termB: "string (second term, relates to A)",
            termC: "string (third term, parallel to A)",
            correctAnswer: "string (fourth term, relates to C)",
            acceptableAnswers: "[string] (alternatives, 3-5 options)",
            explanation: "string (why this is correct)",
            hint: "string (optional hint)"
        },
        validation_rules: {
            allTermsRequired: true,
            termMaxLength: 100,
            correctAnswerRequired: true,
            acceptableAnswersMinCount: 1,
            caseInsensitiveMatch: true
        },
        tags: ["reasoning", "analogy", "conceptual", "transfer", "advanced"],
        learningOutcomes: ["Analysis", "Synthesis", "Evaluation"],
        estimatedTime: "120 seconds",
        estimatedDifficulty: 3
    }
];
/**
 * Meta-triggers for intent classification
 */
const META_TRIGGERS = {
    triggers: [
        // Assessment/Quiz related
        "mcq", "multiple choice", "question", "quiz", "test",
        "assessment", "check knowledge", "knowledge check",
        // Reasoning related
        "reasoning", "explain why", "reasoning prompt", "why",
        "justify", "explain", "think through",
        // Memorization related
        "memorize", "flashcard", "recall", "remember", "memory",
        "definition", "define", "term",
        // Visualization related
        "diagram", "visual", "flowchart", "architecture", "chart",
        "graph", "tree", "structure",
        // Comparison related
        "compare", "signal", "difference", "spot difference",
        "analyze", "security vulnerability",
        // Coding/Practice related
        "code", "sandbox", "coding", "programming", "write code",
        "practice", "exercise", "challenge",
        // Vocabulary related
        "blank", "fill", "blank fill", "vocabulary", "word",
        "completion",
        // Matching related
        "match", "pair", "matching", "terminology",
        // Timeline related
        "timeline", "sequence", "order", "chronological",
        "steps", "process", "flow",
        // Review related
        "review", "spaced", "repeat", "queue", "what to study",
        "study next", "retention",
        // Analogy related
        "analogy", "relationship", "relationship analogy",
        "is to as"
    ],
    version: "1.0",
    lastUpdated: new Date(),
    description: "Keywords used by intent classifier to identify widget requests"
};
/**
 * Widget validation configuration
 */
const WIDGET_VALIDATION_CONFIG = {
    version: "1.0",
    rules: {
        requiredFields: {
            "mcq-v1": ["prompt", "options", "correctAnswer"],
            "mcq-reasoning-v1": ["prompt", "options", "correctAnswer", "requiresReasoning"],
            "flashcard-v1": ["front", "back"],
            "diagram-generator-v1": ["type", "width", "height"],
            "signal-comparison-v1": ["prompt", "signalA", "signalB"],
            "tactical-sandbox-v1": ["taskPrompt", "language", "initialCode", "validationTest"],
            "fill-blank-v1": ["prompt", "sentence", "correctAnswers"],
            "matching-v1": ["prompt", "pairs"],
            "timeline-v1": ["prompt", "events", "correctOrder"],
            "spaced-review-v1": ["topics"],
            "analogy-v1": ["prompt", "termA", "termB", "termC", "correctAnswer"]
        },
        maxPayloadSize: 50000, // 50KB max per widget data
        timeoutMs: 30000
    },
    description: "Validation rules for widget payloads in teaching engine"
};
/**
 * Seed all widgets and configurations to Firestore
 */
async function seedWidgets() {
    console.log("\n🌱 StudyPixel Widget Seeding (v2.0)");
    console.log("=====================================\n");
    try {
        // Step 1: Clear old data (optional)
        // Uncomment to reset widgets (WARNING: destructive)
        // await clearOldWidgets();
        // Step 2: Seed widgets in batches
        console.log(`📝 Seeding ${WIDGETS.length} widgets...`);
        await seedWidgetsInBatches(WIDGETS);
        // Step 3: Create configuration documents
        console.log("\n⚙️  Creating configuration documents...");
        await createConfigurations();
        // Step 4: Verify seeding
        console.log("\n✅ Verification Report:");
        await verifyWidgets();
        console.log("\n✅ Widget seeding completed successfully!");
        console.log("📊 Summary:");
        console.log(`   - Widgets seeded: ${WIDGETS.length}`);
        console.log(`   - Config docs created: 3`);
        console.log(`   - Total operations: ${WIDGETS.length + 3}`);
        console.log("\n🚀 Next Steps:");
        console.log("   1. Verify in Firebase Console: https://console.firebase.google.com");
        console.log("   2. Frontend: Implement widget UI components");
        console.log("   3. Integration: Wire BKT for spaced-review-v1");
        console.log("   4. Testing: Use test prompts from WIDGET_TEST_PROMPTS.md");
        process.exit(0);
    }
    catch (error) {
        console.error("\n❌ Seeding failed:", error.message);
        console.error("Stack trace:", error.stack);
        process.exit(1);
    }
}
/**
 * Seed widgets in batches (Firebase limit: 500 operations per batch)
 */
async function seedWidgetsInBatches(widgets) {
    let batch = db.batch();
    let operationCount = 0;
    for (let i = 0; i < widgets.length; i++) {
        const widget = widgets[i];
        const ref = db.collection("widgets").doc(widget.widgetId);
        batch.set(ref, {
            ...widget,
            createdAt: new Date(),
            version: widget.version || "1.0"
        });
        operationCount++;
        // Commit batch if we hit the limit
        if (operationCount >= BATCH_SIZE || i === widgets.length - 1) {
            await batch.commit();
            console.log(`   ✓ Batch committed (${operationCount} operations)`);
            batch = db.batch();
            operationCount = 0;
        }
    }
}
/**
 * Create configuration documents
 */
async function createConfigurations() {
    const batch = db.batch();
    // 1. Meta-triggers config
    const metaTriggersRef = db.collection("config").doc("metaTriggers");
    batch.set(metaTriggersRef, META_TRIGGERS, { merge: true });
    // 2. Widget validation config
    const validationRef = db.collection("config").doc("widgetValidation");
    batch.set(validationRef, WIDGET_VALIDATION_CONFIG, { merge: true });
    // 3. Widget categories (for filtering/UI)
    const categoriesRef = db.collection("config").doc("widgetCategories");
    batch.set(categoriesRef, {
        categories: [
            { id: "assessment", name: "Assessment", color: "#FF6B6B", icon: "🎯" },
            { id: "memorization", name: "Memorization", color: "#4ECDC4", icon: "💾" },
            { id: "visualization", name: "Visualization", color: "#45B7D1", icon: "📊" },
            { id: "analysis", name: "Analysis", color: "#96CEB4", icon: "🔍" },
            { id: "coding", name: "Coding Practice", color: "#DDA15E", icon: "💻" },
            { id: "vocabulary", name: "Vocabulary", color: "#BC6C25", icon: "📚" },
            { id: "terminology", name: "Terminology", color: "#C77DFF", icon: "🏷️" },
            { id: "sequencing", name: "Sequencing", color: "#06FFA5", icon: "➡️" },
            { id: "review", name: "Review", color: "#FFD60A", icon: "🔁" },
            { id: "reasoning", name: "Reasoning", color: "#A4161A", icon: "🧠" }
        ],
        version: "1.0"
    }, { merge: true });
    await batch.commit();
    console.log("   ✓ Meta-triggers config created");
    console.log("   ✓ Widget validation config created");
    console.log("   ✓ Widget categories created");
}
/**
 * Verify all widgets were seeded successfully
 */
async function verifyWidgets() {
    const snapshot = await db.collection("widgets").get();
    const seededCount = snapshot.size;
    console.log(`   - Total widgets in Firestore: ${seededCount}`);
    const configSnapshot = await db.collection("config").get();
    console.log(`   - Config documents: ${configSnapshot.size}`);
    if (seededCount === WIDGETS.length) {
        console.log("   - Status: ✅ All widgets seeded");
    }
    else {
        console.log(`   - ⚠️  Warning: Expected ${WIDGETS.length}, found ${seededCount}`);
    }
    // Log widget statuses
    const requiresIntegration = WIDGETS.filter(w => w.status === "requires-integration");
    if (requiresIntegration.length > 0) {
        console.log(`\n   🔌 Widgets requiring backend integration:`);
        requiresIntegration.forEach(w => {
            console.log(`      - ${w.widgetId}: ${w.backendDependency}`);
        });
    }
}
/**
 * Optional: Clear old widget data (use with caution!)
 */
async function clearOldWidgets() {
    console.log("🗑️  Clearing old widget data...");
    const snapshot = await db.collection("widgets").get();
    let batch = db.batch();
    let count = 0;
    snapshot.forEach(doc => {
        batch.delete(doc.ref);
        count++;
        if (count >= BATCH_SIZE) {
            batch.commit();
            batch = db.batch();
            count = 0;
        }
    });
    if (count > 0) {
        await batch.commit();
    }
    console.log("   ✓ Old data cleared");
}
/**
 * Export utilities for use in other scripts
 */
module.exports = {
    WIDGETS,
    META_TRIGGERS,
    WIDGET_VALIDATION_CONFIG,
    seedWidgets
};
// Run if executed directly
if (require.main === module) {
    seedWidgets();
}
