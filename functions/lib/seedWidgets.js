"use strict";
const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");
// Initialize Firebase Admin (uses Cloud Shell credentials automatically)
if (admin.apps.length === 0) {
    admin.initializeApp({
        projectId: "studypixel-9d599"
    });
}
async function main() {
    const db = getFirestore();
    const batch = db.batch();
    const widgets = [
        {
            widgetId: "mcq-v1",
            name: "Multiple Choice Question",
            description: "A standard multiple-choice question widget. Supports a prompt, a set of options, and identifies the correct answer. Used for assessments and knowledge drills.",
            required_data_format: "{ prompt: string, options: { [key: string]: string }, correctAnswer: string }"
        },
        {
            widgetId: "mcq-reasoning-v1",
            name: "MCQ with Reasoning",
            description: "An MCQ widget that requires the student to provide a text reasoning. You MUST set 'requiresReasoning': true in the widgetData.",
            required_data_format: "{ prompt: string, options: { [key: string]: string }, correctAnswer: string, requiresReasoning: true }"
        },
        {
            widgetId: "flashcard-v1",
            name: "Flashcard",
            description: "A spaced repetition flashcard with a front and back. Used for memorization and recall.",
            required_data_format: "{ front: string, back: string }"
        },
        {
            widgetId: "diagram-generator-v1",
            name: "Diagram Generator",
            description: "Generates dynamic diagrams. For 'flowchart', provide 'nodes' (list with id, x, y, text) and 'edges' (list with from, to). Fallback: 'labels' (ordered list).",
            required_data_format: "{ type: 'triangle'|'rectangle'|'flowchart', width: number, height: number, labels?: string[], nodes?: [{id,x,y,text}], edges?: [{from,to}] }"
        },
        {
            widgetId: "signal-comparison-v1",
            name: "Signal Comparison",
            description: "Presents two signals (text, code, or logs) for the student to compare and identify differences.",
            required_data_format: "{ prompt: string, signalA: string, signalB: string }"
        },
        {
            widgetId: "tactical-sandbox-v1",
            name: "Tactical Sandbox",
            description: "A code editor environment for the student to write and execute code. Use for coding challenges.",
            required_data_format: "{ taskPrompt: string, language: string, initialCode: string, validationTest: string }"
        }
    ];
    console.log(`Preparing to seed ${widgets.length} widgets...`);
    widgets.forEach((widget) => {
        const ref = db.collection("widgets").doc(widget.widgetId);
        batch.set(ref, widget);
    });
    await batch.commit();
    console.log("✅ Successfully seeded widgets.");
}
main().catch(console.error);
