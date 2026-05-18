/**
 * @fileoverview Integration Guide for Widgets 9-11
 * 
 * This file documents how to integrate the three specialized widgets
 * into the StudyPixel backend. Each widget has unique requirements.
 * 
 * WIDGETS:
 * --------
 * 9.  timeline-v1        — Ready to use (no additional integration)
 * 10. spaced-review-v1   — Requires BKT backend integration
 * 11. analogy-v1         — Ready to use (no additional integration)
 * 
 * PLUS: tactical-sandbox-v1 (Widget 6) also requires code execution integration
 */

/**
 * ============================================================================
 * WIDGET 9: TIMELINE-V1 (Event Sequencing)
 * ============================================================================
 * 
 * STATUS: ✅ READY TO USE
 * No additional backend integration required.
 * 
 * WHAT IT DOES:
 * - LLM generates ordered events
 * - Frontend shuffles and displays as draggable cards
 * - Student rearranges into correct order
 * - Submission validated by frontend (correct order check)
 * 
 * BACKEND RESPONSIBILITY:
 * - Generate widgetData with:
 *   * prompt: "What order should these events go in?"
 *   * events: ["Event1", "Event2", "Event3", ...]
 *   * correctOrder: [1, 3, 0, 2] (indices of correct sequence)
 * 
 * EXAMPLE:
 * --------
 * Input:  "Create a timeline for incident response"
 * Output: {
 *   "action": "USE_WIDGET",
 *   "widgetId": "timeline-v1",
 *   "widgetData": {
 *     "prompt": "Arrange in incident response order",
 *     "events": [
 *       "Eradicate the threat",
 *       "Detect the incident",
 *       "Recover to normal ops",
 *       "Contain the breach"
 *     ],
 *     "correctOrder": [1, 3, 0, 2]  // Detect → Contain → Eradicate → Recover
 *   }
 * }
 * 
 * VALIDATION RULES:
 * - events: 3-7 items
 * - correctOrder: must be array of unique indices
 * - lengths must match (events.length === correctOrder.length)
 * 
 * TESTING:
 * --------
 * Prompt: "Create a timeline exercise: Order these cybersecurity milestones 
 *          chronologically: 1983: TCP/IP, 2014: Heartbleed, 2016: Let's Encrypt, 
 *          2011: SSL deprecated, 2022: SHA-1 sunset"
 * 
 * Note: LLM should extract events and generate correctOrder array.
 *       Frontend handles shuffling.
 */

/**
 * ============================================================================
 * WIDGET 10: SPACED-REVIEW-V1 (BKT-Backed Review Queue)
 * ============================================================================
 * 
 * STATUS: 🔌 REQUIRES BACKEND INTEGRATION
 * 
 * WHAT IT DOES:
 * - Intelligently prioritizes topics for spaced repetition
 * - Uses Bayesian Knowledge Tracing (BKT) to estimate mastery
 * - Uses Ebbinghaus forgetting curve to estimate retention
 * - Recommends topics most likely to be forgotten
 * 
 * BACKEND RESPONSIBILITY:
 * 1. Fetch student's topic mastery scores from BKT
 * 2. Calculate retention % based on time since review
 * 3. Sort by urgency: low_retention * high_days = highest priority
 * 4. Return top 5-10 topics
 * 
 * INTEGRATION STEPS:
 * ------------------
 * 
 * Step 1: In runTeachingAgent(), after consensus calculation:
 * ─────────────────────────────────────────────────────────────
 * 
 * // Update student's BKT profile
 * const studentId = payload.userId;  // Assume passed in context
 * const topic = context.topic;       // Current topic
 * const evidence = assessmentResult.averageConfidence;  // 0.0 to 1.0
 * 
 * // Get previous mastery score (default 0.25 for new topics)
 * const masteryPrior = (studentBKT?.topics?.[topic]?.mastery) || 0.25;
 * 
 * // Calculate new mastery after this session
 * const masteryNew = calculatePosteriorMastery(masteryPrior, evidence);
 * 
 * // Update Firestore
 * const now = new Date();
 * await db.collection("students").doc(studentId).update({
 *   [`bkt.topics.${topic}.mastery`]: masteryNew,
 *   [`bkt.topics.${topic}.lastReviewed`]: now,
 *   [`bkt.topics.${topic}.reviewCount`]: (studentBKT?.topics?.[topic]?.reviewCount || 0) + 1
 * });
 * 
 * Step 2: Create a function to generate spaced-review widget:
 * ────────────────────────────────────────────────────────────
 * 
 * async function generateSpacedReviewWidget(studentId) {
 *   const studentDoc = await db.collection("students").doc(studentId).get();
 *   const bkt = studentDoc.data()?.bkt?.topics || {};
 *   
 *   // Get all topics and calculate urgency
 *   const topics = Object.entries(bkt).map(([topicName, data]) => {
 *     const daysSinceReview = Math.floor(
 *       (Date.now() - data.lastReviewed.toMillis()) / (1000 * 60 * 60 * 24)
 *     );
 *     
 *     // Ebbinghaus retention: R = e^(-t/S)
 *     // where t = days, S = memory strength (proportional to mastery)
 *     const strength = Math.max(0.1, data.mastery * 10);
 *     const retentionPct = Math.exp(-daysSinceReview / strength) * 100;
 *     
 *     // Urgency = (1 - retention) * days_since_review
 *     const urgency = (1 - retentionPct / 100) * daysSinceReview;
 *     
 *     return {
 *       name: topicName,
 *       masteryScore: data.mastery,
 *       daysSinceReview,
 *       retentionPct: Math.round(retentionPct),
 *       nextDueDate: new Date(Date.now() + daysSinceReview * 24 * 60 * 60 * 1000),
 *       urgency  // Used for sorting
 *     };
 *   });
 *   
 *   // Sort by urgency (highest first)
 *   topics.sort((a, b) => b.urgency - a.urgency);
 *   
 *   // Return top 5-10
 *   return {
 *     action: "USE_WIDGET",
 *     widgetId: "spaced-review-v1",
 *     widgetData: {
 *       topics: topics.slice(0, 10).map(t => ({
 *         name: t.name,
 *         masteryScore: t.masteryScore,
 *         daysSinceReview: t.daysSinceReview,
 *         retentionPct: t.retentionPct,
 *         nextDueDate: t.nextDueDate.toISOString().split('T')[0]
 *       }))
 *     }
 *   };
 * }
 * 
 * Step 3: Wire into intent classification:
 * ─────────────────────────────────────────
 * 
 * In classifyIntent(), add meta-triggers for review:
 * if (prompt.toLowerCase().includes("what should i study") ||
 *     prompt.toLowerCase().includes("review queue") ||
 *     prompt.toLowerCase().includes("spaced review")) {
 *   // Generate spaced review widget
 *   const widget = await generateSpacedReviewWidget(userId);
 *   return {
 *     is_answer: false,
 *     intent: "REVIEW_REQUEST",
 *     widget: widget  // Return directly
 *   };
 * }
 * 
 * FIRESTORE SCHEMA:
 * -----------------
 * Collection: students/{studentId}
 * 
 * {
 *   "bkt": {
 *     "topics": {
 *       "XSS Vulnerabilities": {
 *         "mastery": 0.65,              // Current BKT mastery (0-1)
 *         "lastReviewed": Timestamp,    // Last time reviewed
 *         "reviewCount": 5,             // How many times reviewed
 *         "initialMastery": 0.25,       // Starting prior
 *         "peakMastery": 0.85           // Highest achieved
 *       },
 *       "SQL Injection": {
 *         "mastery": 0.82,
 *         "lastReviewed": Timestamp,
 *         ...
 *       }
 *     }
 *   }
 * }
 * 
 * TESTING:
 * --------
 * 1. Go through several assessment rounds on different topics
 * 2. Each round updates mastery scores
 * 3. After 3-4 topics, ask: "What should I study?"
 * 4. Backend should return topics sorted by urgency
 * 5. Topics with low mastery AND old review date should be top priority
 */

/**
 * ============================================================================
 * WIDGET 11: ANALOGY-V1 (Conceptual Reasoning)
 * ============================================================================
 * 
 * STATUS: ✅ READY TO USE
 * No additional backend integration required.
 * 
 * WHAT IT DOES:
 * - Tests deep conceptual understanding
 * - Presents: "A is to B as C is to ___?"
 * - Student provides answer
 * - Frontend validates against correctAnswer + acceptableAnswers
 * - Shows explanation after submission
 * 
 * BACKEND RESPONSIBILITY:
 * - Generate widgetData with:
 *   * termA, termB, termC: The analogy setup
 *   * correctAnswer: Primary correct answer
 *   * acceptableAnswers: 3-5 alternative correct answers
 *   * explanation: Why this answer is correct
 *   * hint: Optional hint for struggling students
 * 
 * EXAMPLE:
 * --------
 * Input:  "Test my understanding of encryption with an analogy"
 * Output: {
 *   "action": "USE_WIDGET",
 *   "widgetId": "analogy-v1",
 *   "widgetData": {
 *     "prompt": "Complete the analogy",
 *     "termA": "Encryption",
 *     "termB": "Confidentiality",
 *     "termC": "Hash Functions",
 *     "correctAnswer": "Data Integrity",
 *     "acceptableAnswers": [
 *       "Data Integrity",
 *       "integrity",
 *       "message integrity",
 *       "data verification"
 *     ],
 *     "explanation": "Just as encryption provides confidentiality by 
 *                     hiding content, hash functions provide integrity
 *                     by detecting tampering.",
 *     "hint": "Think about security properties: confidentiality vs integrity"
 *   }
 * }
 * 
 * VALIDATION RULES:
 * - All fields required: termA, termB, termC, correctAnswer
 * - acceptableAnswers: 1-5 items
 * - Matching is case-insensitive and trim()s whitespace
 * 
 * TESTING:
 * --------
 * Prompt: "Create an analogy: 'Firewall is to network as ___ is to data'"
 * 
 * Or: "Test my understanding with an analogy about the OSI model"
 * 
 * Note: LLM should generate meaningful analogies where A:B and C:? 
 *       relationships are truly parallel.
 */

/**
 * ============================================================================
 * BONUS: TACTICAL-SANDBOX-V1 (Code Execution)
 * ============================================================================
 * 
 * STATUS: 🔌 REQUIRES CODE EXECUTION SERVICE INTEGRATION
 * 
 * WHAT IT DOES:
 * - Provides interactive code editor for students
 * - Student writes code to solve a challenge
 * - Backend executes code safely and validates output
 * - Shows test results to student
 * 
 * INTEGRATION REQUIREMENTS:
 * ───────────────────────
 * 
 * You need a code execution service:
 * 1. Judge0 API (free, cloud-based)
 * 2. Cloud Functions + Docker (Firebase-native)
 * 3. Replit API (embedded)
 * 
 * RECOMMENDED: Judge0 (simplest)
 * ────────────────────────────────
 * 
 * Step 1: Sign up at https://judge0.com/
 * Step 2: Get API key
 * Step 3: Add to functions/.env.local:
 *   JUDGE0_API_KEY=your_api_key
 * 
 * Step 4: Add code execution handler:
 * 
 * async function executeCode(language, code, testCase) {
 *   const judgeClient = require('axios').create({
 *     baseURL: 'https://judge0.p.rapidapi.com',
 *     headers: {
 *       'X-RapidAPI-Key': process.env.JUDGE0_API_KEY,
 *       'X-RapidAPI-Host': 'judge0.p.rapidapi.com',
 *       'Content-Type': 'application/json'
 *     }
 *   });
 *   
 *   // Map StudyPixel languages to Judge0 language IDs
 *   const langMap = {
 *     python: 71,
 *     javascript: 63,
 *     bash: 46,
 *     java: 62
 *   };
 *   
 *   try {
 *     // Submit code for execution
 *     const response = await judgeClient.post('/submissions', {
 *       source_code: code,
 *       language_id: langMap[language],
 *       stdin: '',  // Optional input
 *       expected_output: testCase
 *     });
 *     
 *     // Poll for result (Judge0 is async)
 *     let token = response.data.token;
 *     let status = 0;
 *     let result;
 *     
 *     while (status === 0) {
 *       await new Promise(r => setTimeout(r, 1000));
 *       const check = await judgeClient.get(`/submissions/${token}`);
 *       status = check.data.status.id;
 *       result = check.data;
 *     }
 *     
 *     return {
 *       stdout: result.stdout || '',
 *       stderr: result.stderr || '',
 *       compile_output: result.compile_output || '',
 *       status: result.status.description,
 *       passed: result.status.id === 3  // 3 = Accepted
 *     };
 *   } catch (err) {
 *     return {
 *       error: err.message,
 *       passed: false
 *     };
 *   }
 * }
 * 
 * Step 5: Wire into teaching engine:
 * 
 * if (response.widgetId === "tactical-sandbox-v1") {
 *   // After student submits code:
 *   const studentCode = studentSubmission.code;
 *   const taskPrompt = response.widgetData.taskPrompt;
 *   const language = response.widgetData.language;
 *   const testCase = response.widgetData.validationTest;
 *   
 *   const result = await executeCode(language, studentCode, testCase);
 *   
 *   // Evaluate based on test result
 *   const passed = result.passed;
 *   const confidence = passed ? 0.95 : 0.2;
 *   
 *   // Send to assessment council as: "Widget Response: [passed/failed]"
 *   // Council determines if they understand the concept
 * }
 * 
 * SECURITY CONSIDERATIONS:
 * ────────────────────────
 * - Judge0 handles sandboxing (safe)
 * - Add rate limiting: 1 execution per 5 seconds per student
 * - Timeout: 10 seconds max per submission
 * - Max code length: 10KB
 * 
 * TESTING:
 * --------
 * Prompt: "Create a Python coding challenge: Write a function to find 
 *          the largest number in an array. Test with [3,7,2,9,1]."
 */

/**
 * ============================================================================
 * IMPLEMENTATION ROADMAP
 * ============================================================================
 * 
 * PHASE 2.1 (This Week):
 * - [ ] Integrate BKT backend for spaced-review-v1
 *        (Blocking: students can't get personalized review)
 * 
 * PHASE 2.2 (Next Week):
 * - [ ] Set up Judge0 API for tactical-sandbox-v1
 *        (Blocking: can't execute student code)
 * 
 * PHASE 2.3 (Parallel):
 * - [ ] Build frontend components for Timeline, Analogy, SpacedReview
 *        (Blocking: UI not visible, only backend response)
 * 
 * PHASE 3 (Future):
 * - [ ] Advanced analogy validation (semantic similarity)
 * - [ ] Concept map widget with D3.js
 * - [ ] Challenge mode with leaderboards
 * 
 * ============================================================================
 */

// Export for reference in index.js
module.exports = {
  INTEGRATION_GUIDE: {
    timeline: {
      status: "ready",
      priority: "low",
      notes: "No additional backend work needed"
    },
    spacedReview: {
      status: "requires-integration",
      priority: "high",
      notes: "Wire BKT engine, update Firestore schema, fetch student profile"
    },
    analogy: {
      status: "ready",
      priority: "low",
      notes: "No additional backend work needed"
    },
    tacticalSandbox: {
      status: "requires-integration",
      priority: "high",
      notes: "Set up Judge0 API, implement code execution handler, add sandboxing"
    }
  }
};
