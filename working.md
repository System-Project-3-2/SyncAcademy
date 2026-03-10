# How Student-Aid-Semantic-Search Works

> A complete guide explaining how every feature of this project works — written in simple English so you can explain any feature to your teacher.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Authentication & User Management](#3-authentication--user-management)
   - [Registration](#31-registration)
   - [OTP Verification](#32-otp-verification)
   - [Login](#33-login)
   - [Forgot & Reset Password](#34-forgot--reset-password)
   - [Role-Based Access Control](#35-role-based-access-control)
   - [Profile Management](#36-profile-management)
4. [Course Management](#4-course-management)
   - [Creating a Course](#41-creating-a-course)
   - [Course Code (Secret Key)](#42-course-code-secret-key)
   - [Co-Teacher Invitations](#43-co-teacher-invitations)
5. [Course Enrollment System](#5-course-enrollment-system)
   - [How Students Join a Course](#51-how-students-join-a-course)
   - [Unenrolling / Dropping a Course](#52-unenrolling--dropping-a-course)
   - [How Enrollment Restricts Visibility](#53-how-enrollment-restricts-visibility)
6. [Material Upload & Text Extraction](#6-material-upload--text-extraction)
   - [Uploading a Material](#61-uploading-a-material)
   - [Text Extraction](#62-text-extraction)
   - [Chunking & Embedding](#63-chunking--embedding)
7. [Semantic Search](#7-semantic-search)
   - [How Semantic Search Works (Step by Step)](#71-how-semantic-search-works-step-by-step)
   - [Topic Relevance Gate](#72-topic-relevance-gate)
   - [Search Filters & History](#73-search-filters--history)
8. [AI Tutor (RAG-Based Chat)](#8-ai-tutor-rag-based-chat)
   - [What is RAG?](#81-what-is-rag)
   - [Full AI Tutor Pipeline](#82-full-ai-tutor-pipeline)
   - [Query Analysis](#83-query-analysis)
   - [Adaptive Retrieval](#84-adaptive-retrieval)
   - [Answer Generation with Ollama](#85-answer-generation-with-ollama)
   - [Self-Evaluation (LLM-as-a-Judge)](#86-self-evaluation-llm-as-a-judge)
   - [Decision Engine (Accept or Retry)](#87-decision-engine-accept-or-retry)
   - [Chat Sessions](#88-chat-sessions)
9. [Announcements & Class Stream](#9-announcements--class-stream)
   - [Creating Announcements](#91-creating-announcements)
   - [Comments & Replies](#92-comments--replies)
   - [Pinning Announcements](#93-pinning-announcements)
10. [Assignments & Grading](#10-assignments--grading)
    - [Teacher Creates an Assignment](#101-teacher-creates-an-assignment)
    - [Student Submits Work](#102-student-submits-work)
    - [Teacher Grades Submissions](#103-teacher-grades-submissions)
    - [Publishing Results](#104-publishing-results)
11. [AI Quiz Generation](#11-ai-quiz-generation)
    - [How AI Generates Quizzes](#111-how-ai-generates-quizzes)
    - [Grounding Validation](#112-grounding-validation)
    - [Manual Quiz Creation](#113-manual-quiz-creation)
    - [Quiz Scheduling & Publishing](#114-quiz-scheduling--publishing)
    - [How Students Take Quizzes](#115-how-students-take-quizzes)
    - [Question Randomization](#116-question-randomization)
12. [Discussion Forum (Q&A)](#12-discussion-forum-qa)
    - [Posting a Discussion](#121-posting-a-discussion)
    - [Replies & Sub-Replies](#122-replies--sub-replies)
    - [Voting & Accepted Answers](#123-voting--accepted-answers)
13. [Events System](#13-events-system)
14. [Notification System](#14-notification-system)
    - [How Notifications Are Created](#141-how-notifications-are-created)
    - [Notification Types](#142-notification-types)
15. [Feedback System](#15-feedback-system)
    - [How Students Submit Feedback](#151-how-students-submit-feedback)
    - [Private vs Public Feedback](#152-private-vs-public-feedback)
    - [Teacher Responds to Feedback](#153-teacher-responds-to-feedback)
    - [Auto-Cleanup of Old Feedback](#154-auto-cleanup-of-old-feedback)
16. [Admin Panel](#16-admin-panel)
17. [Dashboard & Statistics](#17-dashboard--statistics)
18. [File Storage (Cloudinary)](#18-file-storage-cloudinary)
19. [Email Service](#19-email-service)
20. [Dark / Light Theme](#20-dark--light-theme)
21. [Database Models at a Glance](#21-database-models-at-a-glance)

---

## 1. Project Overview

This project is an **upgraded version of Google Classroom** built specifically for **KUET students**. It has all the standard classroom features (courses, assignments, announcements, grading) **plus** powerful AI features that Google Classroom doesn't have:

- **Semantic Search** — search across all uploaded materials using meaning, not just keywords
- **AI Tutor** — ask questions and get answers grounded in your course materials (RAG pipeline)
- **AI Quiz Generation** — automatically generate MCQ quizzes from uploaded materials

The app has three user roles: **Student**, **Teacher**, and **Admin**. Each role has different permissions and dashboards.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Material-UI (MUI) + Vite |
| Backend | Node.js + Express.js |
| Database | MongoDB (via Mongoose ODM) |
| AI / LLM | Ollama running Mistral 7B locally |
| Embeddings | HuggingFace (BAAI/bge-small-en-v1.5) or OpenAI |
| File Storage | Cloudinary |
| Auth | JWT (JSON Web Token) + bcrypt for password hashing |
| Email | Nodemailer |

---

## 3. Authentication & User Management

### 3.1 Registration

**Workflow:**
1. User fills in name, email, password, and 7-digit ID number
2. Backend detects the user's **role** automatically based on their email domain (KUET-specific logic in `detectRoleFromEmail.js`)
3. Password is **hashed** using bcrypt (never stored in plain text)
4. A new user document is created in MongoDB with `isVerified: false`
5. An OTP (one-time password) is generated and **emailed** to the user
6. User is redirected to the OTP verification page

### 3.2 OTP Verification

**Workflow:**
1. User enters the 6-digit OTP they received via email
2. Backend checks if the OTP matches and hasn't expired (valid for **10 minutes**)
3. If valid → `isVerified` is set to `true`, OTP fields are cleared
4. User can now log in

### 3.3 Login

**Workflow:**
1. User enters email + password
2. Backend finds the user by email, compares hashed password using bcrypt
3. If valid → generates a **JWT token** (expires in 1 hour) containing the user's ID
4. Token is sent back to the frontend and stored locally
5. Every future API request includes this token in the `Authorization` header

### 3.4 Forgot & Reset Password

**Workflow:**
1. User clicks "Forgot Password" and enters their email
2. Backend generates an OTP and emails it
3. User enters the OTP + new password
4. Backend verifies OTP, hashes the new password, saves it — done

### 3.5 Role-Based Access Control

There are **two middleware functions** that protect routes:

- **`protect`** — checks the JWT token is valid and loads the user
- **`authorize(...roles)`** — checks the user's role is in the allowed list

Example: A route with `protect, authorize('teacher', 'admin')` means only logged-in teachers and admins can access it. Students will get a 403 Forbidden error.

### 3.6 Profile Management

- Users can view and update their profile (name, avatar)
- Avatar upload goes to local storage (max 5MB, JPG/PNG/GIF/WEBP)
- Users can change their password (must provide current password first)

---

## 4. Course Management

### 4.1 Creating a Course

Only **teachers** and **admins** can create courses. A course has:
- Course number (e.g., "CSE305") — must be unique
- Title (e.g., "Database Systems")
- Description, department, semester

### 4.2 Course Code (Secret Key)

When a course is created, the system auto-generates a **random 8-character alphanumeric code** (like `aB3xK9mP`). This is the "secret key" that students need to join the course — similar to Google Classroom's class code.

Teachers can **regenerate** this code if it gets leaked.

### 4.3 Co-Teacher Invitations

A teacher can invite another teacher to **co-manage** a course:

1. Teacher A sends an invitation to Teacher B
2. Teacher B sees the invitation and can Accept or Reject
3. If accepted → Teacher B gets edit access to that course (upload materials, create announcements, etc.)

---

## 5. Course Enrollment System

### 5.1 How Students Join a Course

**Workflow:**
1. Teacher shares the **course code** with students (verbally, via email, etc.)
2. Student enters the code on the "Join Course" page
3. Backend checks if the code matches any course
4. If valid → creates an `Enrollment` document linking the student to the course (status: "active")
5. The course now appears in the student's "My Courses" list

A student **cannot enroll twice** in the same course (unique compound index on `student + course`).

### 5.2 Unenrolling / Dropping a Course

Students can drop a course anytime. The enrollment status changes to `"dropped"` (not deleted, for record-keeping).

### 5.3 How Enrollment Restricts Visibility

This is a key design decision — **students only see content from courses they're enrolled in**:

- **Materials page**: Only shows materials from enrolled courses
- **Semantic Search**: Search results are filtered to enrolled courses only
- **Announcements / Assignments / Quizzes**: Only visible for enrolled courses
- **Teachers and Admins**: Can see everything (no enrollment restriction)

---

## 6. Material Upload & Text Extraction

### 6.1 Uploading a Material

**Workflow:**
1. Teacher selects a file (PDF, DOCX, or PPTX — max 50MB)
2. File is uploaded to **Cloudinary** (cloud storage) and a URL is returned
3. A `Material` document is saved with title, courseNo, type, fileUrl, etc.
4. The system then extracts text and processes it for search (explained below)

### 6.2 Text Extraction

Different parsers handle different file types:
- **PDF** → `pdfParser.js` extracts text from each page
- **DOCX** → `docParser.js` uses the `docx` library to extract paragraphs
- **PPTX** → `pptxParser.js` extracts text from each slide

The full extracted text is stored in the `textContent` field of the Material document.

### 6.3 Chunking & Embedding

This is the foundation for Semantic Search and the AI Tutor:

1. **Chunking**: The extracted text is split into **600-character chunks** (splitting at sentence boundaries so chunks are readable). This is done by `chunkText.js`.

2. **Embedding**: Each chunk is converted into a **numerical vector** (array of numbers) using HuggingFace's `BAAI/bge-small-en-v1.5` model. This vector captures the **meaning** of the text.

3. **Storage**: Each chunk + its embedding vector is saved as a `MaterialChunk` document in MongoDB, linked to the parent Material.

**Why chunks?** Because search and AI need to find the **specific part** of a 50-page PDF that answers a question. Searching the whole document wouldn't give precise results.

---

## 7. Semantic Search

### 7.1 How Semantic Search Works (Step by Step)

Unlike keyword search (which just matches exact words), semantic search understands **meaning**. Here's the full pipeline:

```
Student types a question
        ↓
1. VALIDATE — Is the query at least 3 characters? Does it contain real words?
        ↓
2. EMBED — Convert the query text into a vector (same model used for chunks)
        ↓
3. COMPARE — Calculate cosine similarity between query vector and EVERY chunk vector
        ↓
4. FILTER — Remove chunks with similarity score below 0.35 (not relevant enough)
        ↓
5. TOPIC GATE — Check if the question's key words actually appear in the chunk text
        ↓
6. ENROLLMENT FILTER — For students, only keep chunks from enrolled courses
        ↓
7. GROUP — Group remaining chunks by material (a material may have multiple matching chunks)
        ↓
8. RANK — Sort materials by their best chunk similarity score
        ↓
9. RETURN — Send top 20 materials to the frontend
```

**Cosine Similarity** is a math operation that measures how similar two vectors are. A score of 1.0 = identical meaning, 0.0 = completely unrelated. Our threshold is **0.35** (anything below is considered not relevant).

### 7.2 Topic Relevance Gate

This is a clever safety check. Embedding models sometimes give high similarity scores for unrelated topics because of shared general words.

**Example problem:** A question about "Newton's laws of physics" might score high against an engineering document because both use words like "force", "action", "reaction".

**How the gate works:**
1. Extract important words from the question (5+ characters, excluding common words like "about", "explain", etc.)
2. Check if at least **25%** of those words appear in the retrieved chunk text
3. If not → reject the match as a false positive

### 7.3 Search Filters & History

- **Course filter**: Students can restrict search to a specific course
- **Type filter**: Filter by material type (e.g., "Lecture Notes", "Slides")
- **Autocomplete**: As you type, the system suggests previous search queries
- **Search history**: All searches are saved so students can revisit past queries

---

## 8. AI Tutor (RAG-Based Chat)

This is the most sophisticated feature of the project.

### 8.1 What is RAG?

**RAG = Retrieval-Augmented Generation**

Instead of just asking an AI a question (where it might make things up), RAG first **retrieves relevant documents** and then asks the AI to answer **using only those documents**. This makes the answers accurate and grounded in actual course materials.

### 8.2 Full AI Tutor Pipeline

```
Student asks: "What is normalization in databases?"
        ↓
┌─────────────────────────────────┐
│ Step 1: QUERY ANALYSIS          │
│ → Type: "conceptual"            │
│ → Complexity: "simple"          │
│ → Sub-queries: [original only]  │
└──────────────┬──────────────────┘
               ↓
┌─────────────────────────────────┐
│ Step 2: ADAPTIVE RETRIEVAL      │
│ → Simple → tight config (top 3) │
│ → Embed query, score all chunks │
│ → Return best-matching chunks   │
└──────────────┬──────────────────┘
               ↓
┌─────────────────────────────────┐
│ Step 3: ANSWER GENERATION       │
│ → Build prompt with chunks      │
│ → Send to Ollama (Mistral 7B)   │
│ → Get 3-sentence answer         │
└──────────────┬──────────────────┘
               ↓
┌─────────────────────────────────┐
│ Step 4: SELF-EVALUATION         │
│ → LLM judges its own answer     │
│ → Scores: faithfulness, coverage│
│ → Verdict: YES / PARTIAL / NO   │
└──────────────┬──────────────────┘
               ↓
┌─────────────────────────────────┐
│ Step 5: DECISION ENGINE         │
│ → Confidence high enough? ✅→ Accept │
│ → Confidence too low? 🔁→ Retry     │
│ → Max 2 retries, then best effort   │
└─────────────────────────────────┘
```

### 8.3 Query Analysis

Before even touching the database, the system analyzes the question **using zero LLM calls** (pure pattern matching):

| What it detects | How | Example |
|----------------|-----|---------|
| **Query Type** | Regex patterns | "What is X?" → factual, "How to X?" → procedural, "Compare X and Y" → comparative |
| **Complexity** | Word count + clause count + pattern matches | Short, single question → simple. Long, multi-part → complex |
| **Sub-queries** | Pattern-based decomposition | "Compare TCP and UDP" → also search "TCP" and "UDP" separately |

This analysis feeds into the retrieval step to decide **how many chunks to retrieve**.

### 8.4 Adaptive Retrieval

The retrieval strategy **adapts** based on query complexity:

| Complexity | Top-K Chunks | Similarity Threshold | Strategy |
|-----------|-------------|---------------------|----------|
| Simple | 3 | 0.50 | Precision-focused (fewer but very relevant chunks) |
| Moderate | 5 | 0.42 | Balanced |
| Complex | 8 | 0.35 | Recall-focused (more chunks, wider net) |

**Multi-query retrieval**: If the query analyzer generated sub-queries, each sub-query is embedded separately. All results are merged, and if the same chunk appears multiple times, only the highest score is kept.

### 8.5 Answer Generation with Ollama

The retrieved chunks are assembled into a **prompt** and sent to **Ollama** (running Mistral 7B locally):

- The system prompt **strictly forbids** the model from using its own training knowledge
- It must answer **only** from the provided context
- Maximum **3 sentences** — no bullet points, no headers
- If the context doesn't have the answer, it must say: *"I don't have enough information in the uploaded materials to answer this."*

**Ollama settings**: Temperature 0.1 (very deterministic, not creative), max 384 tokens, 2-minute timeout.

### 8.6 Self-Evaluation (LLM-as-a-Judge)

After generating an answer, the system asks the **same LLM to judge its own answer**:

It scores four things:
- **Faithfulness** (0–1): What fraction of claims in the answer are actually in the source documents?
- **Coverage** (0–1): How much of the student's question was actually answered?
- **Confidence** (0–1): How sure is the model about its scores?
- **Supported**: "YES" / "PARTIAL" / "NO" — is the answer grounded?

**Robustness features:**
- Only sends the **top 2 chunks** to the judge (prevents context overflow on small models)
- Confidence is **capped at coverage** (can't be confident about an incomplete answer)
- If JSON parsing fails, uses safe default values (never crashes)

### 8.7 Decision Engine (Accept or Retry)

After self-evaluation:
- If `confidence >= threshold` AND `supported !== "NO"` → **Accept** the answer ✅
- Otherwise → **Retry** (re-retrieve chunks with different parameters + regenerate) 🔁
- Maximum **2 retries** — after that, the best attempt so far is returned

### 8.8 Chat Sessions

- Each conversation is stored as a **ChatSession** in the database
- The session title is auto-generated from the first user message
- Each assistant message stores **RAG metadata**: query type, complexity, attempt count, best similarity score, confidence, faithfulness, coverage, and evaluation reasoning
- Students can view past sessions and continue conversations

---

## 9. Announcements & Class Stream

### 9.1 Creating Announcements

**Workflow:**
1. Teacher goes to a course's "Stream" page
2. Enters a title, content, optional attachments and links
3. Announcement is saved and appears at the top of the stream
4. All enrolled students receive a **notification** (in-app + email)

### 9.2 Comments & Replies

Announcements support **multi-level comments**:
- Anyone (student or teacher) can comment on an announcement
- You can reply to a comment (creating nested replies)
- Comments can be edited and deleted (deleting a comment also deletes its replies)

### 9.3 Pinning Announcements

Teachers can **pin** an announcement — pinned announcements always appear at the top of the course stream, above regular posts (sorted by newest first otherwise).

---

## 10. Assignments & Grading

### 10.1 Teacher Creates an Assignment

A teacher creates an assignment with:
- Title, description, due date
- Total marks
- Optional file attachments
- Whether late submission is allowed

All enrolled students get a notification.

### 10.2 Student Submits Work

**Workflow:**
1. Student uploads their file (goes to Cloudinary)
2. System records the submission timestamp and checks if it's **late** (compared to due date)
3. If `allowLateSubmission` is off and it's past due → rejected
4. Students can **re-submit** (replaces the previous submission)

One student = one submission per assignment (enforced by a unique database index).

### 10.3 Teacher Grades Submissions

**Workflow:**
1. Teacher views all submissions for an assignment
2. For each submission, teacher can:
   - Assign a **grade** (number out of total marks)
   - Write **feedback** text
   - Upload an **evaluated copy** (e.g., a marked PDF)
   - Toggle whether the student can see the evaluated copy

### 10.4 Publishing Results

- Teacher clicks "Publish Results" → all students are notified
- Students can view their grades, feedback, and (if allowed) the evaluated script
- Teacher can also **generate a result sheet PDF** with all grades

---

## 11. AI Quiz Generation

### 11.1 How AI Generates Quizzes

This is one of the **selling-point features** that Google Classroom doesn't have.

**Workflow:**
```
Teacher specifies: course, number of questions (1–20), difficulty (easy/medium/hard)
        ↓
1. FETCH MATERIALS — Get all materials for the course from the database
        ↓
2. FETCH CHUNKS — Get all text chunks for those materials
        ↓
3. SELECT DIVERSE CHUNKS — Pick the best chunks using "diverse sampling":
   - Take the longest chunk from each material (most informative)
   - Round-robin across materials (so questions come from different topics)
        ↓
4. GENERATE PER CHUNK — For each selected chunk, ask Ollama to generate 1 MCQ:
   - 4 options (A, B, C, D)
   - Correct answer index
   - Explanation of why it's correct
   - Difficulty tag
        ↓
5. GROUNDING CHECK — Verify the question is actually based on the chunk (not hallucinated)
        ↓
6. SAVE — Create quiz as UNPUBLISHED (teacher reviews before releasing)
```

### 11.2 Grounding Validation

After the AI generates a question, the system checks if the question's **key terms actually appear in the source chunk**. If less than 35% of the key terms are found in the chunk, the question is **rejected** as a hallucination.

This prevents the AI from generating questions based on its general knowledge instead of the uploaded materials.

### 11.3 Manual Quiz Creation

Teachers can also create quizzes manually by typing in each question, options, and correct answer — bypassing the AI entirely.

### 11.4 Quiz Scheduling & Publishing

- A quiz starts as **unpublished** (only the teacher can see it)
- Teacher reviews the AI-generated questions, can edit/remove any
- Teacher can **schedule** a quiz: set a "starts at" and "available until" time window
- Quiz status automatically becomes: **upcoming** → **available** → **expired**
- Teacher publishes → students can see and take the quiz

### 11.5 How Students Take Quizzes

**Workflow:**
1. Student opens an available quiz
2. Questions and options are **randomized** (different order for each student)
3. If there's a time limit, a countdown timer runs
4. Student selects answers and submits
5. System auto-grades by comparing answers to correct indices
6. Score, total marks, and time taken are recorded
7. Student can view their results with explanations per question

**One attempt only** — a student cannot retake the same quiz (enforced by unique index on `quiz + student`).

### 11.6 Question Randomization

To prevent cheating, both **question order** and **option order** are randomized differently for each student:

- Uses the `djb2` hash function on the student's user ID as a **seed**
- Same student always gets the same order (deterministic) but different from other students
- The original order is logged for grading accuracy

---

## 12. Discussion Forum (Q&A)

### 12.1 Posting a Discussion

Any enrolled student or teacher can post a discussion (question/topic) in a course. It has:
- Title, content text
- Optional attachments and links
- Initial status: **"open"**

### 12.2 Replies & Sub-Replies

The discussion supports **3 levels of nesting**:
1. **Discussion** (the original post)
2. **Replies** (direct answers to the discussion)
3. **Sub-replies** (replies to a reply)

Users can edit and delete their own replies. Deleting a reply also deletes all its sub-replies.

### 12.3 Voting & Accepted Answers

- Anyone can **upvote** (+1) or **downvote** (-1) a discussion or reply
- The **original poster** (the person who asked) can mark a reply as the **accepted answer**
- Accepted answers are highlighted and pinned in the view
- When a reply is accepted, the discussion status changes to **"solved"**

This works like a mini StackOverflow inside each course.

---

## 13. Events System

Teachers can create **events** (workshops, competitions, etc.) with:
- Title, description, date, location
- Maximum capacity
- Type: external or on-campus

**Workflow:**
1. Teacher creates an event
2. Students register for the event (`POST /api/events/register`)
3. After the event, the teacher can record **marks/grades** for participants
4. Teacher can **download a result sheet PDF** (generated using PDFKit)

---

## 14. Notification System

### 14.1 How Notifications Are Created

Notifications are created **non-blocking** (using async functions that don't slow down the main operation):

1. When a teacher posts an announcement → `notifyEnrolledStudents()` finds all enrolled students and creates a notification for each one
2. The same helper optionally sends an **email** alongside the in-app notification
3. Frontend shows a **badge count** of unread notifications

Users can:
- View all notifications (paginated, newest first)
- Mark single or all as read
- Delete single or clear all

### 14.2 Notification Types

| Type | Triggered When |
|------|---------------|
| `material_upload` | New material uploaded in an enrolled course |
| `announcement` | New announcement posted |
| `comment` | Someone replies to your discussion/announcement |
| `assignment_created` | New assignment posted |
| `assignment_graded` | Your submission has been graded |
| `result_published` | Assignment results are now visible |
| `evaluated_script` | The marked copy of your assignment is available |
| `feedback_response` | Teacher responded to your feedback |
| `enrollment` | You enrolled in a course |
| `course_invite` | Co-teacher invitation received |
| `quiz_created` | New quiz in your course |
| `quiz_scheduled` | Quiz scheduled for a future time |
| `quiz_published` | Quiz is now available to take |

---

## 15. Feedback System

### 15.1 How Students Submit Feedback

Students can submit feedback about issues they encounter. Each feedback has:
- **Title** and **message** (description of the issue)
- **Category**: Missing Material, Wrong Content, Technical Issue, Private Feedback, or Other

### 15.2 Private vs Public Feedback

- **Public feedback**: Visible to all teachers and admins
- **Private feedback**: Only visible to the **specific teacher** it's addressed to + the student + admins

When submitting private feedback, the student must select a **target teacher**.

### 15.3 Teacher Responds to Feedback

**Workflow:**
1. Teacher sees pending feedback on their dashboard
2. Teacher writes a response message
3. Feedback status changes from "pending" to **"resolved"**
4. Student gets an email notification about the response

### 15.4 Auto-Cleanup of Old Feedback

A **cron job** (`cleanupResolvedFeedbacks.js`) runs periodically and automatically deletes resolved feedback that is older than **30 days**. This keeps the database clean.

---

## 16. Admin Panel

Admins have full control over the platform:

| Action | Description |
|--------|------------|
| **User Management** | List, create, edit, and delete any user. View user statistics (counts by role). |
| **Course Management** | Full CRUD on all courses. Regenerate course codes. |
| **Content Management** | Can delete any material, announcement, assignment, or quiz. |
| **Feedback Overview** | Can see ALL feedback (both public and private). |
| **Platform Statistics** | Dashboard with total users, courses, materials, assignments, quizzes, pending feedback, etc. |

---

## 17. Dashboard & Statistics

Each role gets a personalized dashboard:

**Admin Dashboard:**
- Total users (breakdown by role), total courses, total materials
- Total assignments, submissions (graded vs pending)
- Total quizzes, pending feedback, recent enrollments

**Teacher Dashboard:**
- Courses I created, materials I uploaded
- Enrolled students per course
- Pending submissions to grade, pending feedback to respond
- Upcoming/active quizzes

**Student Dashboard:**
- Enrolled courses count, available materials
- Pending assignments with due dates
- Submitted assignments (how many graded)
- Quiz attempts and average score
- Quick action links: search, AI tutor, feedback, materials

---

## 18. File Storage (Cloudinary)

All files (materials, assignment submissions, attachments, evaluated scripts) are stored on **Cloudinary**, a cloud file hosting service.

**Workflow:**
1. File is uploaded from the frontend
2. Backend receives the file via `multer` middleware (handles multipart form data)
3. `cloudinaryUpload.js` sends the file to Cloudinary and returns a **signed URL**
4. The URL is stored in MongoDB (not the file itself)
5. When downloading, the signed URL ensures only authorized access

**Deletion**: When a material is deleted, `cloudinaryDelete.js` removes it from Cloudinary too.

---

## 19. Email Service

The project uses **Nodemailer** (`sendEmail.js`) for sending emails:

- **OTP emails** — for registration verification and password reset
- **Notification emails** — when announcements are posted, assignments graded, feedback responded, etc.

Emails are sent **non-blocking** (using async/await without awaiting delivery confirmation) so they don't slow down the API response.

---

## 20. Dark / Light Theme

The frontend has a theme toggle (dark mode / light mode):
- Managed via React `ThemeContext`
- User preference is saved in `localStorage` so it persists across sessions
- Material-UI's theme provider applies dark/light palettes globally

---

## 21. Database Models at a Glance

The project has **19 MongoDB collections**:

| Model | Purpose |
|-------|---------|
| **User** | Name, email, hashed password, role, avatar, OTP fields |
| **Course** | Course number, title, department, semester, courseCode (secret key), teachers list |
| **Material** | Title, courseNo, file type, Cloudinary URL, extracted text |
| **MaterialChunk** | 600-char text chunk + embedding vector, linked to Material |
| **Enrollment** | Links a student to a course (status: active/dropped) |
| **Announcement** | Course stream posts with attachments, links, comments, replies |
| **Assignment** | Title, description, due date, total marks, allow late submission |
| **Submission** | Student's uploaded work + grade + feedback + evaluated copy |
| **Quiz** | Questions (MCQ), time limit, scheduling window, published status |
| **QuizAttempt** | Student's answers, score, time taken, randomization order |
| **Discussion** | Q&A posts with multi-level replies, votes, accepted answers |
| **ChatSession** | AI tutor conversation history with RAG metadata per message |
| **Notification** | In-app notifications with type, title, message, read status |
| **Feedback** | Student complaints/suggestions, teacher responses, privacy flag |
| **SearchHistory** | Past search queries with filters and result counts |
| **Event** | Teacher-created events (workshops, competitions) |
| **EventRegistration** | Student sign-ups for events |
| **EventMark** | Grades/marks for event participants |
| **CourseInvitation** | Co-teacher invitations (pending/accepted/rejected) |
