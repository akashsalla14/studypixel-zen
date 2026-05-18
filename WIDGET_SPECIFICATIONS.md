# StudyPixel Widget Catalog & Specifications

## Widget Implementation Framework

All widgets follow this JSON schema for instructor responses:

```json
{
  "action": "USE_WIDGET",
  "mentor_speech": "I'd like to test your knowledge...",
  "widgetId": "EXACT_WIDGET_ID",
  "widgetData": {
    // Schema depends on widgetId
  }
}
```

---

## Current Widgets (v1)

### 1. Multiple Choice Question (`mcq-v1`)
**Purpose:** Single-answer selection with immediate feedback\
**Schema:**
```json
{
  "prompt": "What is X?",
  "options": {
    "A": "First option",
    "B": "Second option",
    "C": "Third option" 
  },
  "correctAnswer": "B"
}
```

---

### 2. MCQ with Reasoning (`mcq-reasoning-v1`)
**Purpose:** Requires student to justify their answer\
**Schema:**
```json
{
  "prompt": "Why is X important?",
  "options": {
    "opt1": "It improves performance",
    "opt2": "It reduces memory usage",
    "opt3": "It's a protocol"
  },
  "correctAnswer": "opt2",
  "requiresReasoning": true,
  "reasoningPrompt": "Explain your reasoning"
}
```

---

### 3. Flashcard (`flashcard-v1`)
**Purpose:** Spaced repetition, term/definition recall\
**Schema:**
```json
{
  "front": "Define: API",
  "back": "Application Programming Interface - a set of protocols for software interaction"
}
```

---

### 4. Diagram Generator (`diagram-generator-v1`)
**Purpose:** Flowcharts, trees, cycles, conceptual diagrams\
**Schema:**
```json
{
  "type": "flowchart",  // or "triangle", "rectangle", "tree", "concept-map"
  "prompt": "Map the authentication flow",
  "labels": ["Client", "API", "DB"],  // simple mode
  "nodes": [
    {"id": "start", "text": "Start", "type": "process", "x": 100, "y": 50},
    {"id": "proc", "text": "Process", "type": "decision", "x": 320, "y": 150}
  ],
  "edges": [
    {"from": "start", "to": "proc", "label": "next", "type": "directed"}
  ],
  "layout": "auto"  // or "manual", "horizontal", "vertical", "layered"
}
```

---

### 5. Signal Comparison (`signal-comparison-v1`)
**Purpose:** Diff two code/logs/behaviors to find differences\
**Schema:**
```json
{
  "prompt": "Spot the 3 differences",
  "signalA": "Code snippet A or log output A",
  "signalB": "Code snippet B or log output B"
}
```

---

### 6. Tactical Sandbox (`tactical-sandbox-v1`)
**Purpose:** Write and execute code (security challenges, puzzles)\
**Schema:**
```json
{
  "taskPrompt": "Write Python code to find the flag",
  "language": "python",  // or "javascript", "bash"
  "initialCode": "# TODO: Your code here\nprint('hello')",
  "validationTest": "assert 'flag' in output"
}
```

---

## New Widgets (v2+)

### 7. Fill-in-the-Blank (`fill-blank-v1`)
**Purpose:** Vocabulary, syntax recall, definition completion\
**Use Cases:**
- Medicine: "The [BLANK] is the longest bone in the body" → "femur"
- Security: "The [BLANK] implements TLS 1.3" → "TLS Record Protocol"
- History: "The [BLANK] War lasted 100 years" → "Hundred Years"

**Frontend Behavior:**
- Display sentence with inline text boxes
- Show hint on hover (optional)
- Student types answers into blanks
- Validate all [BLANK] fields must be filled
- Check against `correctAnswers` array (case-insensitive match)
- Show feedback after submission

**Schema:**
```json
{
  "prompt": "Complete the sentence",
  "sentence": "The [BLANK] is responsible for [BLANK].",
  "correctAnswers": [
    ["system administrator", "infrastructure"],
    ["sys admin", "infra"],  // Alternative answers
    ["admin", "servers"]
  ],
  "hint": "Think about IT roles..."
}
```

**Instructor Directive:**
```
FILL_BLANK guidance for you:
- Use sparingly (1–3 blanks max)
- Make blanks conceptually related
- Provide realistic alternatives in correctAnswers
- Include a helpful hint for struggling students
```

---

### 8. Matching Widget (`matching-v1`)
**Purpose:** Term-definition, cause-effect, attack-defense pairing\
**Use Cases:**
- Security: Match "XSS" ↔ "Inject JavaScript into DOM"
- Biology: Match "Mitochondria" ↔ "Energy production"
- Networking: Match "TCP SYN" ↔ "Connection initiation"

**Frontend Behavior:**
- Two columns: left (terms) and right (shuffled definitions)
- Student clicks term, then clicks definition to pair
- Lines show active connections
- Visual feedback for correct/incorrect pairs
- Submit button validates all pairs
- Show score after submission

**Schema:**
```json
{
  "prompt": "Match security concepts to definitions",
  "pairs": [
    {
      "term": "SQL Injection",
      "definition": "Inserting malicious SQL commands into input fields"
    },
    {
      "term": "CSRF",
      "definition": "Trick user into performing unintended actions"
    },
    {
      "term": "XXE",
      "definition": "Parse untrusted XML to access files or network"
    }
  ]
}
```

**Instructor Directive:**
```
MATCHING guidance for you:
- Create 3–6 pairs (too few = too easy, too many = confusing)
- Terms and definitions should not be identical
- Shuffle right column (frontend handles this)
- Use specific, non-obvious pairings
```

---

### 9. Timeline Ordering (`timeline-v1`)
**Purpose:** Arrange events in chronological/logical order\
**Use Cases:**
- Security: Incident response phases (detect → contain → eradicate → recover)
- History: WWI → WWII → Cold War → Modern era
- Networking: TCP handshake (SYN → SYN-ACK → ACK)
- Protocol steps: DNS query → DNS response → Application query

**Frontend Behavior:**
- Display shuffled event boxes
- Student drag-drops into correct sequence
- Visual feedback: green (correct), yellow (uncertain), red (wrong)
- Submit button validates order
- Show correctOrder as numeric feedback

**Schema:**
```json
{
  "prompt": "Arrange in the correct incident response order",
  "events": [
    "Eradicate the threat",
    "Detect the incident",
    "Recover to normal ops",
    "Contain the breach"
  ],
  "correctOrder": [1, 3, 0, 2]  // indices: "Detect" → "Contain" → "Eradicate" → "Recover"
}
```

**Instructor Directive:**
```
TIMELINE guidance for you:
- Use 3–7 events (too few = trivial, too many = memory test)
- Ensure unambiguous correct order
- Use concrete event names, not vague ones
- Works great for multi-step processes
```

---

### 10. Spaced Review Queue (`spaced-review-v1`)
**Purpose:** Show student topics ready for spaced repetition (BKT-backed)\
**Replaces:** Manual "study queue" requests\
**Prerequisites:** BKT engine integration (Phase 3)

**Frontend Behavior:**
- Display cards: topic name, mastery%, days since review
- "Review Now" → start flashcards on that topic
- "Skip" → mark as skipped (decrease priority)
- "Mark Mastered" → set mastery to 100% (unlock new topics)
- Sort by urgency: low retention + old review date = top priority

**Schema:**
```json
{
  "topics": [
    {
      "name": "XSS Vulnerabilities",
      "masteryScore": 0.6,        // 0–1 from BKT
      "daysSinceReview": 7,
      "retentionPct": 65,         // Ebbinghaus decay estimate
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
```

**Instructor Directive:**
```
SPACED_REVIEW guidance for you:
- Use when student asks "What should I study?" or after a session completes
- Data populated by BKT engine (backend computes topics + scores)
- Show 5–10 highest-priority topics
- This is passive review (student chooses) vs. active intervention
```

---

### 11. Analogy Completion (`analogy-v1`)
**Purpose:** Test deep conceptual understanding ("A is to B as C is to ?")\
**Test Type:** Transfer of knowledge, analogy reasoning\
**Use Cases:**
- "Firewall is to network as [BLANK] is to data"
- "Binary search is to O(log n) as linear search is to [BLANK]"
- "API is to software as [BLANK] is to hardware"

**Frontend Behavior:**
- Display: "A is to B as C is to ___?"
- Text input for answer
- Optional hint shown on request
- Fuzzy matching on correctAnswer (case-insensitive, trim whitespace)
- Show feedback + explanation after submission

**Schema:**
```json
{
  "prompt": "Complete the analogy",
  "termA": "Encryption",
  "termB": "Confidentiality",
  "termC": "Hash Functions",
  "correctAnswer": "Data Integrity",
  "explanation": "Just as encryption provides confidentiality, hash functions provide integrity assurance.",
  "hint": "Think about security properties...",
  "acceptableAnswers": [
    "Data Integrity",
    "integrity",
    "message integrity",
    "data verification"
  ]
}
```

**Instructor Directive:**
```
ANALOGY guidance for you:
- Use for deep conceptual questions
- A-B relationship MUST parallel C-D
- Acceptable answers: list 3–5 alternatives
- Avoid trick questions; focus on genuine analogies
```

---

### 12. Concept Map (Planned, v2.1)
**Purpose:** Interactive knowledge graph visualization\
**Status:** Requires D3.js or React Flow integration\
**Deferred:** Implement after Phase 2 core widgets

---

## Widget Adoption Strategy

### Phase 1 (Immediate): Core Learning Widgets
Already seeded in Firestore:
- ✅ `fill-blank-v1`
- ✅ `matching-v1`
- ✅ `timeline-v1`
- ✅ `spaced-review-v1`
- ✅ `analogy-v1`

### Phase 2 (Next Sprint): Dashboard & Teacher Widgets
Requires new Cloud Function:
- `teacher-intervention-queue-v1` (show at-risk students)
- `live-class-heatmap-v1` (mastery grid by topic)
- `bot-analytics-card-v1` (LLM performance insights)

### Phase 3 (Future): Advanced Widgets
Requires data science infrastructure:
- `challenge-mode-v1` (timed questions, pressure mechanics)
- `concept-map-v1` (D3.js force-directed graph)
- `debate-v1` (argue for/against position)

---

## Instructor AI Guidance

When choosing which widget to use, the instructor will receive this system prompt instruction:

```
WIDGET SELECTION CRITERIA:
1. Student got it WRONG → Use: mcq-reasoning-v1, fill-blank-v1 (reinforcement)
2. Student got it RIGHT but LOW confidence → Use: timeline-v1, matching-v1 (deepen)
3. Student is stuck/confused → Use: diagram-generator-v1, flashcard-v1 (scaffold)
4. Student demonstrates mastery → Use: challenge-mode-v1 (coming soon)
5. Student asks for spaced review → Use: spaced-review-v1 (BKT-driven)
6. Student needs conceptual clarity → Use: analogy-v1, signal-comparison-v1

LEARNING STYLE MAPPING (if profile available):
- Visual learner → diagram-generator-v1, concept-map-v1
- Code-first learner → tactical-sandbox-v1, signal-comparison-v1
- Text/theory learner → fill-blank-v1, flashcard-v1
- Interactive learner → timeline-v1, matching-v1

Always prefer interactive widgets (matching, timeline) over passive ones (flashcard, fill-blank).
```

---

## Implementation Checklist

- [ ] Seed all new widgets to Firestore (via seedWidgets)
- [ ] Implement frontend components for each widget
  - [ ] fill-blank-v1
  - [ ] matching-v1
  - [ ] timeline-v1
  - [ ] analogy-v1
  - [ ] spaced-review-v1 (depends on BKT integration)
- [ ] Add widget selection logic to instructor system prompt
- [ ] Test each widget end-to-end
- [ ] Create widget-specific tutorials/help text
- [ ] Monitor usage metrics (which widgets are most effective?)
- [ ] Update instructor prompt as needed (A/B test widget effectiveness)

---

## Testing Scenarios

### Scenario A: Vocabulary Reinforcement
1. Student gets MCQ wrong: "What does API mean?"
2. Instructor uses fill-blank-v1: "An [BLANK] allows two software systems to communicate"
3. Correct answer: "API", "interface", "application programming interface"
4. Student types "Application Programming Interface" → Correct!

### Scenario B: Deep Reasoning
1. Student demonstrates mastery of XSS
2. Instructor uses analogy-v1: "XSS is to HTML DOM as [BLANK] is to system memory"
3. Student types "buffer overflow" → Correct! Shows transfer of knowledge

### Scenario C: Process Understanding  
1. Student asks: "How does incident response work?"
2. Instructor uses timeline-v1 with 5 incident response phases
3. Student arranges: Detect → Contain → Eradicate → Recover → Lessons Learned → Correct!

---

## Success Metrics

1. **Time-to-mastery**: Do spaced-review-v1 + timeline-v1 reduce time vs. text alone?
2. **Retention**: Do analogy-v1 + matching-v1 improve long-term recall?
3. **Engagement**: Which widgets have highest completion rate?
4. **Effectiveness**: Compare pre/post mastery scores by widget type

---

**Next:**
See `WIDGET_IMPLEMENTATION.md` for frontend component specifications.
