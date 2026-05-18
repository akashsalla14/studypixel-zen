# StudyPixel-GPT: The Adaptive Learning Operating System

StudyPixel-GPT is not just a chatbot; it is a **comprehensive, role-based adaptive tutoring platform** designed to revolutionize education. It functions as a "Learning Operating System" where AI tutors, known as **PixelBots**, continuously observe, teach, evaluate, and adapt to each learner's unique pace and style in real-time. By combining advanced cognitive modeling with a professional-grade interface, StudyPixel creates a personalized learning journey for every student while giving teachers powerful oversight tools.

---

## 🧠 The "Brain": How Our AI Works

At the heart of StudyPixel is a sophisticated **Multi-LLM Council** architecture. Instead of relying on a single AI model, we use a team of specialized AI agents working together in the backend (powered by Firebase Cloud Functions and DigitalOcean Serverless Inference) to ensure high-quality, accurate, and pedagogically sound interactions.

Here is how the layers of our AI "Brain" function:

1.  **Layer -1: Intent Router (The Traffic Controller)**
    *   **What it does:** Instantly analyzes every message a student sends.
    *   **Why:** It decides if the student is just saying "hello" (Conversational), asking for help (Meta), or actually answering a question (Answer). This prevents the system from trying to grade "Hi there!" as an incorrect answer.

2.  **Layer 1: Teaching Engine (The Instructor)**
    *   **What it does:** This is the main conversational agent that talks to the student.
    *   **Why:** It uses the consensus from the other layers to decide *how* to respond. Should it explain a concept, ask a follow-up question, or launch an interactive widget? It adapts its tone and strategy based on the student's current struggle or success.

3.  **Layer 2: Assessment Council (The Graders)**
    *   **What it does:** When a student answers a question, three different AI models (Evaluator A, B, and C) independently review the answer.
    *   **Why:** This "peer review" system eliminates hallucinations and bias. One model checks for strict factual accuracy, another for conceptual understanding, and a third for supportive effort. They vote to determine if the student has truly mastered the topic.

4.  **Layer 3: Progression Layer (The Strategist)**
    *   **What it does:** Takes the votes from the Assessment Council and calculates a "Mastery Score."
    *   **Why:** It deterministically decides the next step. If mastery is low, it triggers a "Deepen" strategy. If mastery is high, it moves to "Progress." This ensures the difficulty automatically adjusts to the student's performance.

---

## 🎯 Solving the Adaptive Learning Challenge

StudyPixel was built to directly address the core challenges of modern education technology:

*   **Real-Time Adaptation:** The system analyzes student performance instantly. If a student struggles, the AI doesn't just repeat itself; it switches strategies (e.g., from text to a visual diagram) to match their learning style.
*   **Weakness Identification:** Through continuous assessment, the platform identifies specific weak areas and automatically adjusts content difficulty, ensuring students are always challenged but never overwhelmed.
*   **Class-Wide Analytics:** Teachers are not left in the dark. They have access to dashboards showing real-time mastery levels for their entire class, allowing them to see at a glance who is falling behind.
*   **Personalized Intervention:** The system empowers teachers to take action. With features like "Force Revision," teachers can send targeted nudges to students who need extra practice, closing the loop between automated learning and human oversight.

---

## 🖥️ Interface Guide

StudyPixel features three specialized dashboards, ensuring a tailored experience for every user role.

### 🎓 Student Dashboard
*   **Your Learning Hub:** Students can see all the PixelBots assigned by their teachers and track their own progress.
*   **Personalized Growth:** View real-time "Learning Status" (Beginner, Intermediate, Advanced) and access personal analytics to see mastery trends over time.
*   **Interactive Workspace:** The core learning area features a dual-pane interface: a Mentor Chat on the left for conversation and a dynamic "Learning Canvas" on the right for interactive widgets like quizzes, flashcards, and coding sandboxes.

### 🍎 Teacher Dashboard
*   **Command Center:** Teachers get a bird's-eye view of their classes. They can create new AI tutors (PixelBots) simply by chatting with a builder bot.
*   **Live Monitoring:** View a roster of students with live mastery updates. Teachers can filter by academic year and identify students who are "drifting" off track.
*   **Actionable Tools:** Teachers can assign specific bots to classes, broadcast messages, or trigger revision sessions for individual students directly from the dashboard.

### 🛡️ Admin Dashboard
*   **System Oversight:** Administrators manage the entire platform ecosystem.
*   **User Management:** Create and edit teacher and student accounts, reset passwords, and manage role assignments.
*   **Platform Health:** View high-level analytics on total users and system usage to ensure the platform is running smoothly.

---

## 📂 Project Architecture

Our codebase is structured for scalability, maintainability, and clear separation of concerns.

```
studypixel/
├── src/
│   ├── app/                   # Next.js App Router (Global styles & layout)
│   ├── components/            # Reusable UI Components
│   │   ├── auth/              # Login & Authentication screens
│   │   ├── common/            # Shared UI elements (Charts, Buttons)
│   │   ├── dashboards/        # Role-specific Dashboards (Admin, Teacher, Student)
│   │   └── pixelbot/          # The Core Learning Interface
│   │       └── widgets/       # Interactive Learning Tools (MCQ, Sandbox, Diagrams)
│   ├── lib/                   # Backend Integration & Utilities
│   │   ├── dataService.js     # Firestore Data Abstraction Layer
│   │   └── firebase.js        # Firebase Configuration
│   └── ...
├── functions/                 # Firebase Cloud Functions (The AI Backend)
│   ├── index.js               # Main Serverless Entry Point (Multi-LLM Logic)
│   ├── seedWidgets.js         # Database Seeding Scripts
│   └── ...
├── public/                    # Static Assets
└── ...
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
