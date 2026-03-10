# Detailed Implementation Explanation — Student-Aid-Semantic-Search

> This document explains **how every feature is implemented** — the code flow, the files involved, the database queries, the algorithms, and all the technical decisions. If your teacher asks "how does this work?", this document has the answer.

---

## Table of Contents

1. [Project Architecture](#1-project-architecture)
   - [Folder Structure](#11-folder-structure)
   - [How the Server Starts](#12-how-the-server-starts)
   - [Request Lifecycle](#13-request-lifecycle)
2. [Authentication System](#2-authentication-system)
   - [Registration — Step by Step](#21-registration--step-by-step)
   - [OTP Verification — How It Works](#22-otp-verification--how-it-works)
   - [Login — Token Generation](#23-login--token-generation)
   - [JWT Token Validation (protect middleware)](#24-jwt-token-validation-protect-middleware)
   - [Role-Based Authorization (authorize middleware)](#25-role-based-authorization-authorize-middleware)
   - [Forgot & Reset Password Flow](#26-forgot--reset-password-flow)
   - [Role Detection from Email](#27-role-detection-from-email)
3. [Course Management](#3-course-management)
   - [Creating a Course](#31-creating-a-course)
   - [Course Code Generation & Regeneration](#32-course-code-generation--regeneration)
   - [Co-Teacher Invitation System](#33-co-teacher-invitation-system)
4. [Enrollment System](#4-enrollment-system)
   - [Enrolling in a Course](#41-enrolling-in-a-course)
   - [How Enrollment Filtering Works](#42-how-enrollment-filtering-works)
   - [Unenrolling (Dropping a Course)](#43-unenrolling-dropping-a-course)
5. [Material Upload & Processing Pipeline](#5-material-upload--processing-pipeline)
   - [Complete Upload Flow](#51-complete-upload-flow)
   - [Text Extraction — PDF, DOCX, PPTX](#52-text-extraction--pdf-docx-pptx)
   - [Text Chunking Algorithm](#53-text-chunking-algorithm)
   - [Embedding Generation](#54-embedding-generation)
   - [How Chunks Are Stored](#55-how-chunks-are-stored)
   - [Cloudinary File Storage](#56-cloudinary-file-storage)
6. [Semantic Search — Complete Pipeline](#6-semantic-search--complete-pipeline)
   - [Search Request to Response](#61-search-request-to-response)
   - [Query Validation](#62-query-validation)
   - [Embedding the Query](#63-embedding-the-query)
   - [Cosine Similarity — The Math Behind Search](#64-cosine-similarity--the-math-behind-search)
   - [Enrollment-Based Access Control in Search](#65-enrollment-based-access-control-in-search)
   - [Scoring, Filtering & Grouping](#66-scoring-filtering--grouping)
   - [Search History & Autocomplete](#67-search-history--autocomplete)
7. [AI Tutor — RAG Pipeline (The Most Complex Feature)](#7-ai-tutor--rag-pipeline-the-most-complex-feature)
   - [What is RAG and Why We Use It](#71-what-is-rag-and-why-we-use-it)
   - [Stage 1: Query Analysis (Zero LLM Cost)](#72-stage-1-query-analysis-zero-llm-cost)
   - [Stage 2: Adaptive Retrieval](#73-stage-2-adaptive-retrieval)
   - [Stage 3: Answer Generation with Ollama](#74-stage-3-answer-generation-with-ollama)
   - [Stage 4: Self-Evaluation (LLM-as-a-Judge)](#75-stage-4-self-evaluation-llm-as-a-judge)
   - [Stage 5: Decision Engine (Accept or Retry)](#76-stage-5-decision-engine-accept-or-retry)
   - [Topic Relevance Gate — Preventing False Positives](#77-topic-relevance-gate--preventing-false-positives)
   - [Chat Session Management](#78-chat-session-management)
   - [Ollama Service — How We Talk to the LLM](#79-ollama-service--how-we-talk-to-the-llm)
8. [Announcements & Class Stream](#8-announcements--class-stream)
   - [Creating an Announcement](#81-creating-an-announcement)
   - [Comments and Nested Replies](#82-comments-and-nested-replies)
   - [Pinning & Ordering](#83-pinning--ordering)
9. [Assignment & Grading System](#9-assignment--grading-system)
   - [Creating an Assignment](#91-creating-an-assignment)
   - [Student Submission Flow](#92-student-submission-flow)
   - [Late Submission Handling](#93-late-submission-handling)
   - [Teacher Grading Flow](#94-teacher-grading-flow)
   - [Publishing Results](#95-publishing-results)
   - [Result Sheet PDF Generation](#96-result-sheet-pdf-generation)
10. [AI Quiz Generation System](#10-ai-quiz-generation-system)
    - [How the AI Creates Quiz Questions](#101-how-the-ai-creates-quiz-questions)
    - [Diverse Chunk Selection Algorithm](#102-diverse-chunk-selection-algorithm)
    - [The LLM Prompt for Question Generation](#103-the-llm-prompt-for-question-generation)
    - [Grounding Validation — Catching Hallucinations](#104-grounding-validation--catching-hallucinations)
    - [JSON Parsing with 4-Stage Fallback](#105-json-parsing-with-4-stage-fallback)
    - [Manual Quiz Creation](#106-manual-quiz-creation)
    - [Quiz Scheduling & Status](#107-quiz-scheduling--status)
    - [Student Quiz Taking — Randomization System](#108-student-quiz-taking--randomization-system)
    - [Auto-Grading with Randomization Reversal](#109-auto-grading-with-randomization-reversal)
11. [Discussion Forum (Q&A)](#11-discussion-forum-qa)
    - [How Posts, Replies, and Sub-Replies Work](#111-how-posts-replies-and-sub-replies-work)
    - [Voting System Implementation](#112-voting-system-implementation)
    - [Accepted Answers](#113-accepted-answers)
12. [Events System](#12-events-system)
    - [Event Creation & Registration](#121-event-creation--registration)
    - [Marks & Result Sheet](#122-marks--result-sheet)
13. [Notification System](#13-notification-system)
    - [How Notifications Are Created (Non-Blocking)](#131-how-notifications-are-created-non-blocking)
    - [Bulk Notification with Optional Email](#132-bulk-notification-with-optional-email)
    - [All Notification Types](#133-all-notification-types)
14. [Feedback System](#14-feedback-system)
    - [Submission and Privacy Rules](#141-submission-and-privacy-rules)
    - [Teacher Response Flow](#142-teacher-response-flow)
    - [Auto-Cleanup Cron Job](#143-auto-cleanup-cron-job)
15. [Admin Panel](#15-admin-panel)
    - [User Management](#151-user-management)
    - [Platform Statistics](#152-platform-statistics)
16. [Email Service Implementation](#16-email-service-implementation)
17. [Profile & User Management](#17-profile--user-management)
18. [Database Models — Complete Schemas](#18-database-models--complete-schemas)
19. [Frontend Architecture](#19-frontend-architecture)
    - [Routing & Protected Routes](#191-routing--protected-routes)
    - [Auth Context & Token Management](#192-auth-context--token-management)
    - [API Service Layer](#193-api-service-layer)
    - [Theme System](#194-theme-system)

---

## 1. Project Architecture

### 1.1 Folder Structure

The project follows a **layered architecture** pattern:

```
backend/
├── server.js              ← Entry point: starts Express, connects DB, mounts routes
├── config/                ← Database & Cloudinary configuration
├── routes/                ← Define API endpoints + which middleware/controller handles them
├── controllers/           ← Business logic: handle request → process → send response
├── services/              ← Complex logic (AI, RAG, embeddings, quiz generation)
├── models/                ← Mongoose schemas (define MongoDB document structure)
├── middleware/            ← Intercept requests before controller (auth, upload)
├── utils/                 ← Helper functions (email, parsing, chunking, etc.)
└── uploads/               ← Temporary file storage (files are moved to Cloudinary)

frontend/
├── src/
│   ├── pages/             ← Full-page components (Dashboard, Login, Materials, etc.)
│   ├── components/        ← Reusable UI components (Navbar, Sidebar, Cards)
│   ├── services/          ← API call functions (one per backend feature)
│   ├── context/           ← React Context providers (Auth, Theme)
│   ├── hooks/             ← Custom React hooks
│   ├── router/            ← React Router configuration
│   └── layouts/           ← Page layout wrappers (DashboardLayout)
```

**The flow of a request:**
```
Frontend (React) → HTTP Request → Express Route → Middleware → Controller → Service/Model → Response
```

### 1.2 How the Server Starts

**File: `backend/server.js`**

When you run `node server.js`, this happens in order:

1. **Load environment variables** from `.env` file using `dotenv.config()`
2. **Connect to MongoDB** — calls `connectDB()` from `config/db.js` which runs `mongoose.connect(process.env.MONGO_URI)`
3. **Create Express app** — `const app = express()`
4. **Apply global middleware:**
   - `cors()` — allows requests from the frontend domain
   - `express.json()` — parses JSON request bodies
   - `express.urlencoded({extended: true})` — parses form data
5. **Mount all route files:**
   - `/api/auth` → authRoutes
   - `/api/users` → userRoutes
   - `/api/courses` → courseRoutes
   - `/api/materials` → materialRoutes
   - `/api/search` → searchRoutes
   - `/api/chat` → chatRoutes
   - `/api/announcements` → announcementRoutes
   - `/api/assignments` → assignmentRoutes
   - `/api/quizzes` → quizRoutes
   - `/api/discussions` → discussionRoutes
   - `/api/notifications` → notificationRoutes
   - `/api/feedbacks` → feedbackRoutes
   - `/api/enrollments` → enrollmentRoutes
   - `/api/admin` → adminRoutes
   - `/api/stats` → statsRoutes
   - `/api/events` → eventRoutes
   - `/api/course-invitations` → courseInvitationRoutes
6. **Start the cron job** — `deleteResolvedFeedbacks()` schedules hourly cleanup
7. **Listen on PORT** — `app.listen(process.env.PORT || 5000)`

### 1.3 Request Lifecycle

Every API request goes through this chain:

```
1. Client sends HTTP request (e.g., POST /api/materials with file)
     ↓
2. Express matches the URL to a route file (materialRoutes.js)
     ↓
3. Route applies middleware in order:
   a. protect     → verifies JWT token, loads user from DB
   b. authorize   → checks user.role is allowed
   c. upload      → handles file upload (multer saves to /uploads/)
     ↓
4. Controller function runs:
   a. Reads req.body, req.params, req.file, req.user
   b. Calls Mongoose models (database operations)
   c. May call services (AI, embedding, etc.)
   d. Sends res.json() or res.status(error)
     ↓
5. Response goes back to the client
```

---

## 2. Authentication System

### 2.1 Registration — Step by Step

**Files involved:** `authController.js` → `detectRoleFromEmail.js` → `userModel.js` → `sendEmail.js`

**Detailed flow:**

**Step 1 — Receive request:**
The frontend sends `POST /api/auth/register` with body `{name, email, password, idNumber}`.

**Step 2 — Detect role from email:**
The `detectRoleFromEmail(email)` function in `utils/detectRoleFromEmail.js` checks the email domain:
- `@stud.kuet.ac.bd` → returns `"student"`
- `@kuet.ac.bd` (but not stud.kuet) → returns `"teacher"`
- `@admin.kuet.ac.bd` → returns `"admin"`
- Anything else → returns `null` (registration rejected)

There are also hardcoded test emails for development: `teacher@test.com`, `admin@test.com`, `student@test.com`.

**Step 3 — Validate uniqueness:**
```
User.findOne({ email }) → if exists → 400 "User already exists"
```
Also validates idNumber is exactly 7 digits (`/^\d{7}$/` regex) and unique.

**Step 4 — Hash the password:**
```javascript
const salt = await bcrypt.genSalt(10);       // generate random salt
const hashedPassword = await bcrypt.hash(password, salt);  // hash password with salt
```
The password is **never stored in plaintext**. bcrypt adds salt automatically to prevent rainbow table attacks. The `10` is the cost factor (number of hashing rounds = 2^10 = 1024).

**Step 5 — Generate OTP:**
```javascript
const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // expires in 10 minutes
```

**Step 6 — Create user document in MongoDB:**
```javascript
const user = await User.create({
  name, email,
  password: hashedPassword,  // hashed, not plain
  role,                       // detected from email
  idNumber,
  otp,
  otpExpiry,
  isVerified: false          // not verified yet
});
```

**Step 7 — Send OTP email:**
```javascript
await sendEmail(email, "Verify your email", `Your OTP is: ${otp}. Valid for 10 minutes.`);
```

**Step 8 — Return response** (without password field).

### 2.2 OTP Verification — How It Works

**File:** `otpController.js`

When the user enters the OTP on the verification page:

```
POST /api/auth/verify-otp  { email, otp }
     ↓
1. Find user: User.findOne({ email })
     ↓
2. Check OTP match: user.otp === otp
     ↓
3. Check expiry: Date.now() <= user.otpExpiry
     ↓
4. If valid:
   user.isVerified = true;
   user.otp = undefined;        // clear OTP
   user.otpExpiry = undefined;   // clear expiry
   await user.save();
     ↓
5. Return success
```

If the OTP has expired (more than 10 minutes), the user must request a new one.

### 2.3 Login — Token Generation

**File:** `authController.js → loginUser()`

```
POST /api/auth/login  { email, password }
     ↓
1. Find user: User.findOne({ email })
   → If not found → 400 "Invalid credentials"
     ↓
2. Compare password:
   await bcrypt.compare(password, user.password)
   → This hashes the input password the same way and compares
   → If mismatch → 400 "Invalid credentials"
     ↓
3. Generate JWT token:
   const token = jwt.sign(
     { id: user._id },           // payload: just the user ID
     process.env.JWT_SECRET,      // secret key (from .env)
     { expiresIn: "1h" }         // token expires in 1 hour
   );
     ↓
4. Return: { token, user: {name, email, role, idNumber, ...} }
```

The JWT token is a Base64-encoded string containing three parts: header, payload, signature. The payload has the user's MongoDB `_id`. The signature ensures the token hasn't been tampered with.

### 2.4 JWT Token Validation (protect middleware)

**File:** `middleware/authMiddleware.js`

Every protected route runs this middleware BEFORE the controller:

```
Request arrives with header: "Authorization: Bearer <jwt_token>"
     ↓
1. Extract token from header:
   token = req.headers.authorization.split(" ")[1]
   (Also checks req.query.token as fallback for file downloads)
     ↓
2. Verify token:
   const decoded = jwt.verify(token, process.env.JWT_SECRET)
   → If invalid/expired → 401 "Token invalid"
     ↓
3. Load user from database:
   req.user = await User.findById(decoded.id).select("-password")
   → The -password means "load everything EXCEPT the password field"
   → If user deleted → 401 "User not found"
     ↓
4. Call next() → request continues to the controller
   The controller can now access req.user (the logged-in user)
```

### 2.5 Role-Based Authorization (authorize middleware)

**File:** `middleware/roleMiddleware.js`

This middleware is applied AFTER `protect` and restricts access by role:

```javascript
// Usage in route: protect, authorize('teacher', 'admin')
export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    next();
  };
};
```

For example, `authorize('teacher', 'admin')` means:
- If `req.user.role === "student"` → 403 Forbidden
- If `req.user.role === "teacher"` → allowed, continue
- If `req.user.role === "admin"` → allowed, continue

### 2.6 Forgot & Reset Password Flow

**Two-step process:**

**Step 1 — Request reset (forgotPassword):**
```
POST /api/auth/forgot-password  { email }
     ↓
Find user by email → generate new OTP (6-digit) → set 10-min expiry → save to user doc → send email
```

**Step 2 — Execute reset (resetPassword):**
```
POST /api/auth/reset-password  { email, otp, newPassword }
     ↓
Find user → verify OTP + expiry → hash new password with bcrypt → update user.password → clear OTP fields → save
```

### 2.7 Role Detection from Email

**File:** `utils/detectRoleFromEmail.js`

The system automatically determines what role a user should have based on their KUET email:

| Email Pattern | Role |
|--------------|------|
| `anything@stud.kuet.ac.bd` | student |
| `anything@kuet.ac.bd` (not stud) | teacher |
| `anything@admin.kuet.ac.bd` | admin |
| Any other email | null (rejected) |

This means users cannot choose their own role — it's determined by their institutional email domain.

---

## 3. Course Management

### 3.1 Creating a Course

**Files:** `courseController.js` → `courseModel.js`

```
POST /api/courses  { courseNo, title, description, department, semester }
(Only teacher/admin)
     ↓
1. Validate courseNo uniqueness: Course.findOne({ courseNo })
     ↓
2. Generate course code (8-char random alphanumeric string):
   This is the secret key students use to join
     ↓
3. Create course document:
   Course.create({
     courseNo, title, description, department, semester,
     courseCode: generatedCode,
     createdBy: req.user._id,      // the teacher
     teachers: [req.user._id]      // teacher is in the teachers array
   })
     ↓
4. Return the created course
```

**Course Model Schema:**
```
courseNo       — String, required, unique (e.g., "CSE305")
title          — String, required (e.g., "Database Systems")
description    — String
department     — String
semester       — String
courseCode     — String (8-char random, used for enrollment)
createdBy      — ObjectId reference to User (the course creator)
teachers       — [ObjectId references to User] (includes creator + co-teachers)
timestamps     — createdAt, updatedAt (auto-managed by Mongoose)
```

### 3.2 Course Code Generation & Regeneration

The course code is an 8-character alphanumeric string generated randomly. Students use this code to join the course (similar to Google Classroom's class code).

Teachers can regenerate the code if it gets shared publicly:
```
POST /api/courses/:id/regenerate-code
     ↓
1. Verify the requesting user is the course owner or admin
2. Generate new random 8-char code
3. Update course.courseCode
4. Return new code
```

### 3.3 Co-Teacher Invitation System

**Files:** `courseInvitationController.js` → `courseInvitationModel.js`

**How it works:**

```
Teacher A sends invitation:
POST /api/course-invitations  { courseId, invitedTeacherId }
     ↓
1. Verify Teacher A owns/manages the course
2. Verify invitedTeacher is actually a teacher role
3. Create CourseInvitation { course, invitedBy: A, invitedTeacher: B, status: "pending" }
4. Notify Teacher B
     ↓
Teacher B responds:
PUT /api/course-invitations/:id/respond  { status: "accepted" | "rejected" }
     ↓
If accepted:
  → Add Teacher B to course.teachers array
  → Teacher B can now manage that course
```

---

## 4. Enrollment System

### 4.1 Enrolling in a Course

**Files:** `enrollmentController.js` → `enrollmentModel.js`

```
POST /api/enrollments/enroll  { courseCode: "aB3xK9mP" }
(Student only)
     ↓
1. Find course by code: Course.findOne({ courseCode })
   → If not found → 400 "Invalid course code"
     ↓
2. Check duplicate: Enrollment.findOne({ student: req.user._id, course: course._id })
   → If exists and active → 400 "Already enrolled"
   → If exists and dropped → reactivate: set status = "active"
     ↓
3. Create enrollment:
   Enrollment.create({
     student: req.user._id,
     course: course._id,
     status: "active"
   })
     ↓
4. Return success with course details
```

**Database index:** There's a unique compound index on `{ student, course }` — MongoDB itself prevents duplicate enrollment records.

### 4.2 How Enrollment Filtering Works

This is a critical design pattern used across the entire application. When a student requests data, the system first checks which courses they're enrolled in, then filters results:

**In Semantic Search (`searchController.js`):**
```javascript
// 1. Get student's enrolled course numbers
const enrollments = await Enrollment.find({
  student: req.user._id,
  status: "active"
}).populate("course", "courseNo");

const enrolledCourseNos = enrollments.map(e => e.course.courseNo);

// 2. Add filter to material query
materialFilter.courseNo = { $in: enrolledCourseNos };
// This MongoDB query means: only return materials WHERE courseNo IS IN the enrolled list
```

**In Materials (`materialController.js`):**
Same pattern — students only see materials from their enrolled courses.

**In Assignments, Quizzes, Announcements:** Same pattern — everything is scoped to enrolled courses.

**Teachers and Admins:** These roles bypass enrollment filtering — they can see everything.

### 4.3 Unenrolling (Dropping a Course)

```
POST /api/enrollments/unenroll/:courseId
     ↓
Find enrollment → set status = "dropped" → save
```

The enrollment record is NOT deleted — it's kept with `status: "dropped"` for record-keeping. The student can re-enroll later (status changes back to "active").

---

## 5. Material Upload & Processing Pipeline

### 5.1 Complete Upload Flow

**Files:** `materialController.js` → `uploadMiddleware.js` → parsers → `chunkText.js` → `embeddingServices.js` → `cloudinaryUpload.js` → `notificationHelper.js`

This is a multi-step pipeline:

```
Teacher uploads PDF/DOCX/PPTX via frontend
     ↓
Step 1: MULTER MIDDLEWARE (uploadMiddleware.js)
  - Intercepts multipart form data
  - Saves file temporarily to backend/uploads/ folder
  - Max file size: 50MB
  - Allowed extensions: .pdf, .docx, .pptx
  - req.file now contains {path, originalname, mimetype, size}
     ↓
Step 2: TEXT EXTRACTION (controller calls the right parser)
  - Check file extension:
    if .pdf  → extractPdfText(req.file.path)
    if .docx → extractDocText(req.file.path)
    if .pptx → extractPptx(req.file.path)
  - Result: a string containing all the text from the file
     ↓
Step 3: UPLOAD TO CLOUDINARY
  - uploadToCloudinary(req.file.path)
  - File is sent to Cloudinary's cloud storage
  - Returns a secure URL (e.g., https://res.cloudinary.com/xxx/raw/upload/v123/file.pdf)
  - Temporary file is deleted from server after upload
     ↓
Step 4: SAVE MATERIAL DOCUMENT
  - Material.create({
      title, courseTitle, courseNo, type,
      fileUrl: cloudinaryUrl,
      originalFileName: req.file.originalname,
      textContent: extractedText,
      uploadedBy: req.user._id
    })
     ↓
Step 5: CHUNKING
  - chunkText(textContent, 600) → splits text into ~600 char pieces at sentence boundaries
  - Example: A 6000-char document produces ~10 chunks
     ↓
Step 6: EMBEDDING (for each chunk)
  - For each chunk: embedding = await embedText(chunkText)
  - This calls HuggingFace API with the chunk text
  - Returns a vector of numbers (e.g., 384 dimensions for bge-small-en-v1.5)
  - This vector represents the MEANING of that text in mathematical form
     ↓
Step 7: SAVE CHUNKS
  - For each chunk + embedding pair:
    MaterialChunk.create({
      materialId: newMaterial._id,
      chunkText: chunk,
      embedding: vectorArray    // e.g., [0.023, -0.156, 0.089, ...]  × 384 numbers
    })
     ↓
Step 8: NOTIFY STUDENTS (non-blocking)
  - notifyEnrolledStudents({
      courseId, type: "material_upload",
      title: "New Material Uploaded",
      message: `${title} has been uploaded in ${courseTitle}`
    })
  - This runs asynchronously — the upload response is sent before notifications finish
```

### 5.2 Text Extraction — PDF, DOCX, PPTX

**PDF Parsing (`pdfParser.js`):**
Uses the `pdfjs-dist` library (same library that powers Firefox's PDF viewer):
```
1. Read file into memory as Uint8Array
2. getDocument({ data: buffer }) → load PDF
3. For each page (1 to pdf.numPages):
   a. page.getTextContent() → get text items
   b. Join all text items with spaces
   c. Append to fullText with newline separator
4. Return fullText
```

**DOCX Parsing (`docParser.js`):**
Uses the `mammoth` library:
```
1. Read file buffer with fs.readFileSync()
2. mammoth.extractRawText({ buffer }) → extracts all paragraph text
3. Return result.value (plain text, no formatting)
```

**PPTX Parsing (`pptxParser.js`):**
Uses the `officeparser` library:
```
1. Read file buffer with fs.readFileSync()
2. officeParser.parseOfficeAsync(buffer) → extracts text from all slides
3. Return text string
```

### 5.3 Text Chunking Algorithm

**File:** `utils/chunkText.js`

**Why chunk?** A 50-page PDF might have 50,000 characters of text. If a student asks a question, we need to find the **specific paragraph** that answers it — not the whole document. Chunking splits the text into digestible pieces.

**Algorithm — sentence-aware splitting:**

```
Input: text = "Sentence one. Sentence two. Sentence three. ..."
       chunkSize = 600

1. Split text on sentence boundaries: text.split(/(?<=[.!?])\s+/)
   → The regex (?<=[.!?])\s+ means "split after a period/exclamation/question mark followed by whitespace"
   → Result: ["Sentence one.", "Sentence two.", "Sentence three.", ...]

2. Build chunks by accumulating sentences:
   currentChunk = ""
   For each sentence:
     If (currentChunk + sentence <= 600 chars):
       Add sentence to currentChunk
     Else:
       Save currentChunk to chunks array
       Start new chunk with this sentence

3. Special case: If a single sentence is > 600 chars:
   Split it into 600-char slices (hard split, may break mid-word)

4. Don't forget the final chunk (whatever's left in currentChunk)

Return: array of chunk strings
```

**Example:**
```
Input: 1800 characters of text, chunkSize = 600
Output: 3 chunks of ~600 characters each (split at sentence boundaries)
```

The key insight is that chunks **respect sentence boundaries** — they don't cut in the middle of a sentence, which makes them more meaningful for search and AI.

### 5.4 Embedding Generation

**File:** `services/embeddingServices.js`

**What is an embedding?** It's a way to convert text into a list of numbers (a vector) that captures the **meaning** of the text. Similar texts produce similar vectors.

**Provider: HuggingFace (default, free):**
- Model: `BAAI/bge-small-en-v1.5` — a lightweight embedding model optimized for English text
- Produces vectors with **384 dimensions** (384 numbers per chunk)
- Called via HuggingFace's Inference API (free tier)

```
embedText("Normalization reduces data redundancy in databases")
     ↓
POST https://router.huggingface.co/hf-inference/models/BAAI/bge-small-en-v1.5
Body: { inputs: "Normalization reduces data redundancy in databases" }
Headers: Authorization: Bearer <HF_API_KEY>, x-wait-for-model: true
     ↓
Response: [0.023, -0.156, 0.089, 0.445, -0.012, ...]  (384 numbers)
```

**Provider: OpenAI (alternative, paid):**
- Model: `text-embedding-3-large`
- Higher quality embeddings but costs money per request
- Configured via `EMBEDDING_PROVIDER=openai` in `.env`

The provider is selected at startup:
```javascript
const EMBEDDING_PROVIDER = process.env.EMBEDDING_PROVIDER || "huggingface";
// Default is huggingface (free)
```

### 5.5 How Chunks Are Stored

**MaterialChunk Model:**
```
materialId  — ObjectId reference to the parent Material document
chunkText   — The actual text content of this chunk (string)
embedding   — Array of Numbers (the vector), e.g., 384 floats
timestamps  — createdAt, updatedAt
```

**Relationship:**
```
Material (1) ←→ (many) MaterialChunk
   A PDF with 10,000 chars → ~17 chunks → 17 MaterialChunk documents
   Each chunk has its own embedding vector
```

### 5.6 Cloudinary File Storage

**File:** `utils/cloudinaryUpload.js` and `config/cloudinary.js`

**Cloudinary** is a cloud service for storing files (like AWS S3 but easier for images/documents).

**Upload process:**
```javascript
const result = await cloudinary.uploader.upload(filePath, {
  folder: "student-aid/materials",   // organize files in folders
  resource_type: "auto",             // auto-detect file type (PDF, image, etc.)
  type: "upload",
  access_mode: "public"              // publicly accessible URL
});
return result.secure_url;            // https://res.cloudinary.com/xxx/...
```

After uploading, the **temporary file on the server is deleted**:
```javascript
finally {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);   // delete temp file
  }
}
```

**Deletion (`cloudinaryDelete.js`):**
When a material is deleted, the file must be removed from Cloudinary too. The function parses the Cloudinary URL to extract the `public_id`, then calls `cloudinary.uploader.destroy(publicId)`.

---

## 6. Semantic Search — Complete Pipeline

### 6.1 Search Request to Response

**Files:** `searchController.js` → `embeddingServices.js` → `cosineSimilarity.js` → `searchHistoryModel.js`

```
Student types: "What is normalization in databases?"
Frontend sends: POST /api/search  { query: "What is normalization in databases?", courseNo: null, type: null }
     ↓
STEP 1: VALIDATE QUERY
     ↓
STEP 2: EMBED QUERY → convert to 384-dimension vector
     ↓
STEP 3: BUILD FILTERS (enrollment-based for students)
     ↓
STEP 4: FETCH ALL CHUNKS from database (matching filters)
     ↓
STEP 5: SCORE each chunk against query using cosine similarity
     ↓
STEP 6: FILTER (remove low scores < 0.35)
     ↓
STEP 7: GROUP by material (keep best score per material)
     ↓
STEP 8: SORT by relevance score descending
     ↓
STEP 9: RETURN top 20 materials
     ↓
STEP 10: SAVE to search history (non-blocking)
```

### 6.2 Query Validation

Before any processing, the query is validated:

```javascript
const validateQuery = (query) => {
  const trimmed = query.trim();

  // Rule 1: Minimum 3 characters
  if (trimmed.length < 3) {
    return { valid: false, message: "Search query must be at least 3 characters long" };
  }

  // Rule 2: Must contain at least one real word (2+ alphabetic characters)
  const words = trimmed.split(/\s+/).filter(w => /[a-zA-Z]{2,}/.test(w));
  if (words.length === 0) {
    return { valid: false, message: "Please enter a meaningful search query with real words" };
  }

  return { valid: true };
};
```

This prevents searches like "abc", "123", or random symbols from wasting embedding API calls.

### 6.3 Embedding the Query

The search query is converted to the same type of vector as the stored chunks:

```javascript
const queryEmbedding = await embedText(query.trim());
// Returns: [0.034, -0.221, 0.156, ...]  (384 numbers)
```

This is the same `embedText()` function used during material upload. Both the query and the chunks use the same model, so their vectors are comparable.

### 6.4 Cosine Similarity — The Math Behind Search

**File:** `utils/cosineSimilarity.js`

**What is cosine similarity?** It measures the angle between two vectors. If two vectors point in the same direction, they're similar (score near 1.0). If they're perpendicular, they're unrelated (score near 0.0).

**The formula:**

$$\text{cosine}(\vec{A}, \vec{B}) = \frac{\vec{A} \cdot \vec{B}}{|\vec{A}| \times |\vec{B}|}$$

**Implementation:**
```javascript
export const cosineSimilarity = (vecA, vecB) => {
  let dotProduct = 0;    // numerator
  let normA = 0;         // |A|²
  let normB = 0;         // |B|²

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];    // sum of A[i] × B[i]
    normA += vecA[i] ** 2;              // sum of A[i]²
    normB += vecB[i] ** 2;              // sum of B[i]²
  }

  normA = Math.sqrt(normA);    // |A|
  normB = Math.sqrt(normB);    // |B|

  if (normA === 0 || normB === 0) return 0;   // avoid division by zero

  return dotProduct / (normA * normB);         // result: -1 to 1 (usually 0 to 1)
};
```

**Why cosine and not Euclidean distance?** Because cosine similarity measures the **direction** of vectors, not their **magnitude**. A long detailed chunk and a short summary about the same topic will point in the same direction even though their vectors have different lengths.

### 6.5 Enrollment-Based Access Control in Search

For students, search results are automatically restricted to their enrolled courses:

```javascript
if (req.user.role === "student") {
  // 1. Find all courses the student is enrolled in
  const enrollments = await Enrollment.find({
    student: req.user._id,
    status: "active"
  }).populate("course", "courseNo");

  // 2. Extract course numbers
  const enrolledCourseNos = enrollments.map(e => e.course.courseNo);
  // e.g., ["CSE305", "CSE317", "EEE201"]

  // 3. Add to material filter
  if (courseNo) {
    // Student specified a course — verify they're enrolled
    if (!enrolledCourseNos.includes(courseNo)) {
      materialFilter.courseNo = "__none__";  // will match nothing
    } else {
      materialFilter.courseNo = courseNo;
    }
  } else {
    // No course filter — restrict to all enrolled courses
    materialFilter.courseNo = { $in: enrolledCourseNos };
  }
}
```

Teachers and admins skip this check — they can search across all materials.

### 6.6 Scoring, Filtering & Grouping

**Scoring all chunks:**
```javascript
// Fetch all chunks, populating the material they belong to
const chunks = await MaterialChunk.find().populate({
  path: 'materialId',
  match: materialFilter    // only materials matching our filter
});

// Score each chunk against the query
const scored = chunks
  .filter(c => c.materialId !== null)    // remove chunks from non-matching materials
  .map(chunk => ({
    materialId: chunk.materialId._id,
    title: chunk.materialId.title,
    courseTitle: chunk.materialId.courseTitle,
    courseNo: chunk.materialId.courseNo,
    type: chunk.materialId.type,
    fileUrl: chunk.materialId.fileUrl,
    originalFileName: chunk.materialId.originalFileName,
    text: chunk.chunkText,
    score: cosineSimilarity(queryEmbedding, chunk.embedding)
  }));
```

**Filtering:**
```javascript
// Only keep chunks with similarity >= 0.35
const filtered = scored.filter(s => s.score >= 0.35);

// Sort by score descending and take top 50
const topScored = filtered.sort((a, b) => b.score - a.score).slice(0, 50);
```

**Grouping by material:**
A single material (e.g., a PDF) has many chunks. We don't want to show the same PDF 10 times. So we group chunks by their parent material and keep the **best score**:

```javascript
const grouped = {};
for (const item of topScored) {
  const key = item.materialId.toString();
  if (!grouped[key]) {
    grouped[key] = {
      materialId: key,
      title: item.title,
      courseTitle: item.courseTitle,
      courseNo: item.courseNo,
      type: item.type,
      fileUrl: item.fileUrl,
      originalFileName: item.originalFileName,
      relevanceScore: item.score,       // best score so far
      matches: [item.text]              // matching chunk texts
    };
  } else {
    // Keep the highest score
    if (item.score > grouped[key].relevanceScore) {
      grouped[key].relevanceScore = item.score;
    }
    // Add chunk text to matches (max 5 per material)
    if (grouped[key].matches.length < 5) {
      grouped[key].matches.push(item.text);
    }
  }
}

// Sort by relevance and return top 20 materials
const results = Object.values(grouped)
  .sort((a, b) => b.relevanceScore - a.relevanceScore)
  .slice(0, 20);
```

### 6.7 Search History & Autocomplete

**Saving searches (non-blocking):**
After returning results, the query is saved for history:
```javascript
SearchHistory.create({
  user: req.user._id,
  query: query.trim(),
  resultsCount: results.length,
  filters: { courseNo, type }
}).catch(() => {}); // silently ignore save errors
```

**Autocomplete suggestions:**
When the student starts typing, the frontend calls:
```
GET /api/search/suggestions?q=norma
```

The controller searches across:
- Recent search queries (regex match)
- Course titles (regex match)
- Material titles (regex match)

Returns up to 10 deduplicated suggestions.

---

## 7. AI Tutor — RAG Pipeline (The Most Complex Feature)

### 7.1 What is RAG and Why We Use It

**RAG = Retrieval-Augmented Generation**

**The problem with plain LLMs:** If you just ask an AI like ChatGPT "What is normalization?", it answers from its training data — which might be wrong, outdated, or not aligned with what your professor taught.

**How RAG solves this:**
1. **Retrieve** the most relevant chunks from your actual course materials
2. **Augment** a prompt with those chunks as context
3. **Generate** an answer that is grounded in your actual materials

This way, the AI can only say things that are written in your uploaded materials. If the materials don't cover a topic, the AI says "I don't have enough information" instead of making things up.

### 7.2 Stage 1: Query Analysis (Zero LLM Cost)

**File:** `services/queryAnalyzer.js`

Before talking to the LLM (which is slow), we analyze the question using **pure pattern matching** (regex) — zero API calls needed.

**What it determines:**

**1. Query Type** — classified using regex:
```
"What is normalization?"     → FACTUAL    (matches /^what is/i)
"How to design a database?"  → PROCEDURAL (matches /^how to/i)
"Compare SQL and NoSQL"      → COMPARATIVE (matches /\bcompare\b/i)
"Why is indexing important?"  → CAUSAL     (matches /\bwhy\b/i)
Short or unclear questions   → AMBIGUOUS  (word count < 4)
Everything else              → CONCEPTUAL (default)
```

**2. Complexity** — scored by multiple signals:
```javascript
let score = 0;
if (wordCount > 20)                   score += 2;   // long question
else if (wordCount > 10)              score += 1;
if (clauseCount >= 2)                 score += 1;   // multiple clauses (commas)
if (COMPARATIVE_PATTERNS.test(query)) score += 2;   // comparison questions are complex
if (MULTI_PART_PATTERNS.test(query))  score += 1;   // "and", "both", etc.
if (CAUSAL_PATTERNS.test(query))      score += 1;   // "why", "because", etc.

Result: score >= 4 → "complex", >= 2 → "moderate", else → "simple"
```

**3. Sub-query expansion** — breaking complex questions into simpler searches:

For "Compare TCP and UDP":
```
Original: "Compare TCP and UDP"
Split on "and": → also search "TCP" and "UDP" separately
Result: ["Compare TCP and UDP", "TCP", "UDP"]
```

Each sub-query is embedded and searched separately, then results are merged. This captures more relevant chunks because "TCP" alone will match chunks that mention TCP without comparing.

**4. Initial confidence** — a rough pre-retrieval estimate:
```
Base: 0.70
Adjustments: ambiguous → -0.30, factual → +0.10, complex → -0.10, simple → +0.05
Clamped to [0.1, 1.0]
```

### 7.3 Stage 2: Adaptive Retrieval

**File:** `services/adaptiveRetriever.js`

**The key idea:** Different types of questions need different retrieval strategies. A simple factual question ("What is X?") needs just a few highly-relevant chunks. A complex comparative question needs more chunks from different sources.

**Configuration table:**
```
                    topK    threshold    noContextThreshold
simple:              3       0.50         0.42
moderate:            5       0.42         0.36
complex:             8       0.35         0.30
```

- **topK** — maximum number of chunks to pass to the LLM (more = richer context, but slower)
- **threshold** — minimum cosine similarity to keep a chunk (higher = more strict)
- **noContextThreshold** — if the BEST score is below this, there's truly nothing relevant

**Multi-query retrieval process:**
```
Sub-queries: ["Compare TCP and UDP", "TCP", "UDP"]
     ↓
1. Embed ALL queries in parallel:
   embeddings = await Promise.all(queries.map(q => embedText(q)))
   → 3 embedding vectors (one per sub-query)
     ↓
2. Score ALL chunks against each embedding in parallel:
   scoredArrays = await Promise.all(embeddings.map(e => scoreAllChunks(e, filters)))
   → 3 arrays of scored chunks
     ↓
3. Merge & deduplicate:
   - Key = first 80 characters of chunk text
   - If same chunk appears in multiple arrays, keep highest score
   → Single deduplicated array
     ↓
4. Sort by score descending
     ↓
5. Record bestScore (highest score, even if below threshold)
     ↓
6. Filter: score >= threshold (e.g., 0.42 for moderate)
     ↓
7. Cap at topK (e.g., 5 for moderate)
     ↓
Return: { topChunks, bestScore, config }
```

### 7.4 Stage 3: Answer Generation with Ollama

**File:** `services/ragService.js` + `services/ollamaService.js`

**How the prompt is built:**

```
[System Prompt - strict rules]
You are a study assistant that ONLY reads the CONTEXT below.

RULES — violating any rule means your answer is wrong:
1. Every sentence you write MUST be directly supported by text in the CONTEXT.
2. Do NOT use any knowledge from your training. The CONTEXT is your only source.
3. If the question cannot be fully answered from the CONTEXT alone, say EXACTLY:
   "I don't have enough information in the uploaded materials to answer this."
4. If ANY part of the answer is missing from the CONTEXT, use rule 3 instead.
5. Maximum 3 sentences. No bullet points. No headers. No elaboration.

[CONTEXT START]
[CSE305 - Database Systems]: Normalization is a process of organizing data in a database
to reduce redundancy and dependency. It involves dividing large tables into smaller ones
and defining relationships between them...

[CSE305 - Database Systems]: The main goal of normalization is to eliminate redundant
data and ensure data is stored logically. Normal forms include 1NF, 2NF, 3NF, and BCNF...
[CONTEXT END]

Student question: What is normalization in databases?
Answer based only on the context above (3 sentences max):
```

**Ollama settings for answer generation:**
```javascript
generateResponse(prompt, {
  temperature: 0.1,    // Very low — almost no randomness, very factual
  max_tokens: 350,     // Short answer limit
  // num_ctx: 2048     — context window
  // repeat_penalty: 1.3 — discourage repeating phrases
});
```

**Why temperature 0.1?** Low temperature makes the model more deterministic and factual. High temperature (like 0.7) would make it creative — which we don't want for a study assistant.

**How Ollama works:**
- Ollama is a local LLM server (runs on your machine)
- We send HTTP POST to `http://localhost:11434/api/generate`
- It runs Mistral 7B (a 7 billion parameter language model)
- The response comes back as a JSON with the generated text
- Timeout: 2 minutes (some questions take a while)

### 7.5 Stage 4: Self-Evaluation (LLM-as-a-Judge)

**File:** `services/selfEvaluator.js`

After the AI generates an answer, we ask **the same AI** to judge its own answer. This is a technique from AI research called "LLM-as-a-Judge."

**What the judge evaluates (4 dimensions):**

| Metric | What It Measures | Range |
|--------|-----------------|-------|
| **Faithfulness** | What fraction of claims in the answer are actually in the context documents? | 0.0 to 1.0 |
| **Coverage** | What fraction of the student's question was actually answered? | 0.0 to 1.0 |
| **Confidence** | How certain is the model about its faithfulness and coverage scores? | 0.0 to 1.0 |
| **Supported** | Overall groundedness verdict | "YES" / "PARTIAL" / "NO" |

**The judge prompt:**
```
You are a JSON scorer. Output ONLY valid JSON — no text before or after.

Output format:
{"faithfulness":SCORE,"coverage":SCORE,"confidence":SCORE,"supported":"?"}

Rules:
- Replace each SCORE with a decimal between 0.0 and 1.0
- Replace "?" with exactly one of: "YES", "PARTIAL", "NO"
```

**Robustness features (why this doesn't crash):**

**1. Only top-2 chunks sent to judge (not all):**
Small models like Mistral 7B struggle with long contexts. Sending only the 2 best chunks keeps the prompt short.

**2. Calibration — correcting overconfidence:**
```javascript
// Rule: confidence can't be higher than coverage
if (confidence > coverage) confidence = coverage;
```
Why? The model can't be "very confident" about an answer that barely covers the question.

**3. Three-tier fallback for JSON parsing:**
```
Tier 1: Direct JSON.parse(raw) → works if model output is clean
     ↓ (if fails)
Tier 2: Strip markdown code fences, extract {...} with regex → parse
     ↓ (if fails)
Tier 3: Return SAFE_DEFAULT { faithfulness: 0.5, coverage: 0.5, confidence: 0.5, supported: "PARTIAL" }
```

The `SAFE_DEFAULT` ensures the pipeline **never crashes** even if the LLM returns garbage.

**4. Fast-path for "I don't know" answers:**
If the answer contains phrases like "don't have enough information" or "not in the uploaded materials", the evaluator skips the LLM call entirely and returns `{faithfulness: 0, coverage: 0, confidence: 0, supported: "NO", pass: true}`.

### 7.6 Stage 5: Decision Engine (Accept or Retry)

**File:** `services/ragService.js`

After self-evaluation, the system decides whether to accept or retry:

```
Pass gate:
  (confidence >= 0.50 OR faithfulness >= 0.50) AND supported !== "NO"
     ↓
If PASS → Accept the answer ✅
     ↓
If FAIL and attempt < MAX_RETRIES (2):
  → Add "explain in detail" and "definition example" to sub-queries
  → Go back to Stage 2 (retrieve + generate again) 🔁
     ↓
If FAIL and max retries reached:
  → Check "accept best effort" conditions:
    bestScore >= 0.55 AND faithfulness >= 0.40 AND supported !== "NO"
  → If yes → return answer with a note
  → If no → return "I don't have enough information..." message
```

**Why retry?** Sometimes the first retrieval misses the best chunk. Adding different query phrasings ("explain in detail", "definition example") can surface chunks that the original query missed.

### 7.7 Topic Relevance Gate — Preventing False Positives

**File:** `services/ragService.js`

This is an important safety check that happens BETWEEN retrieval and answer generation.

**The problem:** Embedding models sometimes give high similarity scores for unrelated content. Example:
- Question: "What are Newton's laws of motion?" (physics)
- Chunk: "The gravitational force acts on structures..." (civil engineering)
- Cosine similarity: 0.55 (looks relevant but isn't!)

**How the gate works:**
```javascript
const checkTopicRelevance = (question, chunks) => {
  // 1. Extract "signal words" from the question
  //    (5+ chars, not in stop word list)
  const signalWords = question
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 5 && !TOPIC_STOP_WORDS.has(w));

  // Example: "What is normalization in databases?"
  // Signal words: ["normalization", "databases"]

  // 2. Check if ≥25% of signal words appear in chunk texts
  const combinedText = chunks.map(c => c.text.toLowerCase()).join(' ');
  const matchCount = signalWords.filter(w => combinedText.includes(w)).length;
  const ratio = matchCount / signalWords.length;

  return ratio >= 0.25;  // MIN_MATCH_RATIO
};
```

If the gate fails (signal words not found in chunks), the system returns the no-info message immediately without asking the LLM — saving time and preventing hallucinations.

### 7.8 Chat Session Management

**File:** `chatController.js` → `chatSessionModel.js`

Chat conversations are stored as sessions in MongoDB:

```
POST /api/chat  { message: "What is normalization?", sessionId: null }
     ↓
1. If no sessionId → create new ChatSession
   If sessionId → load existing session and verify ownership
     ↓
2. Add user message to session:
   session.messages.push({ role: "user", content: message })
     ↓
3. Build chat history (last 4 messages = 2 exchanges) for context
     ↓
4. Run RAG pipeline: ragChat(message, chatHistory, filters)
     ↓  
5. Add assistant message to session:
   session.messages.push({
     role: "assistant",
     content: answer,
     sources: [...],
     ragMetadata: {
       queryType: "conceptual",
       complexity: "simple",
       attempt: 1,
       bestScore: 0.72,
       confidence: 0.85,
       faithfulness: 0.90,
       coverage: 0.80,
       supported: "YES",
       evalReasoning: "..."
     }
   })
     ↓
6. Auto-title: if this is the first message, set session title from message text
     ↓
7. Save session and return response
```

Each assistant message stores **RAG metadata** — this is valuable for debugging and research. You can see exactly how confident the AI was, how many attempts it took, and what the self-evaluation scores were.

### 7.9 Ollama Service — How We Talk to the LLM

**File:** `services/ollamaService.js`

The project uses **Ollama** as a local LLM server. Ollama runs on your machine and serves model inference via HTTP.

**Three functions:**

**1. `generateResponse(prompt, options)` — for answer generation:**
- POST to `http://localhost:11434/api/generate`
- Non-streaming (waits for full response)
- Temperature: 0.1 (very deterministic)
- Max tokens: 384
- Timeout: 2 minutes

**2. `generateResponseStream(prompt, options)` — for streaming responses:**
- Same endpoint but with `stream: true`
- Returns a ReadableStream (tokens come one by one)
- Used for real-time typing effect

**3. `generateChatJSON(systemPrompt, userPrompt, options)` — for structured JSON output:**
- POST to `http://localhost:11434/api/chat`
- Has `format: "json"` — forces Ollama to output valid JSON
- Used for self-evaluation and quiz generation
- Separate system + user messages
- Temperature: 0.0 (completely deterministic)

**Error handling:**
```javascript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 120000);  // 2-minute timeout

// If Ollama doesn't respond in 2 minutes, the request is aborted
// The controller catches the error and returns a friendly message
```

---

## 8. Announcements & Class Stream

### 8.1 Creating an Announcement

**Files:** `announcementController.js` → `announcementModel.js` → `notificationHelper.js`

```
POST /api/announcements  { courseId, title, content, attachments, links }
(Teacher/Admin only)
     ↓
1. Verify the user can manage this course (creator or co-teacher or admin)
     ↓
2. Upload any attachments to Cloudinary
     ↓
3. Create announcement:
   Announcement.create({
     course: courseId,
     author: req.user._id,
     title, content,
     isPinned: false,
     attachments: [{ fileName, fileUrl, fileType }],
     links: [url1, url2],
     comments: []
   })
     ↓
4. Notify all enrolled students (non-blocking):
   notifyEnrolledStudents({
     courseId,
     type: "announcement",
     title: "New Announcement",
     message: `${title} in ${courseTitle}`
   })
```

**Announcement Model Schema:**
```
course       — ObjectId ref to Course
author       — ObjectId ref to User
title        — String, required
content      — String (the announcement text)
isPinned     — Boolean, default false
attachments  — [{ fileName: String, fileUrl: String, fileType: String }]
links        — [String] (URLs)
comments     — [commentSchema]  (nested sub-documents, see below)
timestamps   — createdAt, updatedAt
```

### 8.2 Comments and Nested Replies

Comments support **multi-level nesting**:

```
Announcement
  └── Comment (by any user)
        └── Reply to comment (by any user)
```

**Adding a comment:**
```
POST /api/announcements/:id/comments  { text }
     ↓
announcement.comments.push({
  user: req.user._id,
  text: text.trim(),
  replies: [],
  createdAt: new Date()
})
await announcement.save()
```

**Adding a reply to a comment:**
```
POST /api/announcements/:id/comments/:commentId/replies  { text }
     ↓
const comment = announcement.comments.id(commentId)
comment.replies.push({
  user: req.user._id,
  text: text.trim(),
  createdAt: new Date()
})
await announcement.save()
```

**Deleting a comment cascades** — removes the comment and all its replies.

### 8.3 Pinning & Ordering

When fetching announcements for a course:
```javascript
const announcements = await Announcement.find({ course: courseId })
  .sort({ isPinned: -1, createdAt: -1 });  // Pinned first, then newest
```

The sort order ensures pinned announcements always appear at the top, and within each group, newer posts come first.

---

## 9. Assignment & Grading System

### 9.1 Creating an Assignment

**Files:** `assignmentController.js` → `assignmentModel.js`

```
POST /api/assignments  { courseId, title, description, dueDate, totalMarks, allowLateSubmission, files }
(Teacher/Admin only)
     ↓
1. Upload attachment files to Cloudinary → get URLs
     ↓
2. Create assignment:
   Assignment.create({
     course: courseId,
     createdBy: req.user._id,
     title: title.trim(),
     description: description.trim(),
     dueDate: dueDate || undefined,
     totalMarks: totalMarks || 100,
     isPublished: true,
     allowLateSubmission: allowLateSubmission === "true",
     attachments: [{ fileName, fileUrl }]
   })
     ↓
3. Notify enrolled students
```

### 9.2 Student Submission Flow

```
POST /api/assignments/:id/submit  { file, textContent }
(Student only)
     ↓
1. Find assignment and verify student is enrolled in the course
     ↓
2. Check if results have been published:
   if (assignment.isResultPublished) → 400 "Results already published"
     ↓
3. Check for existing submission:
   Submission.findOne({ assignment: id, student: req.user._id })
   - If exists → this is a RE-SUBMISSION (update existing)
   - If not → this is a NEW submission
     ↓
4. Upload file to Cloudinary (if provided)
     ↓
5. Calculate late status:
   const isLate = assignment.dueDate ? (new Date() > assignment.dueDate) : false;
     ↓
6. If late AND assignment.allowLateSubmission === false:
   → 403 "Late submissions not allowed"
     ↓
7. Create/update submission:
   {
     assignment: assignment._id,
     student: req.user._id,
     fileUrl, fileName, textContent,
     submittedAt: new Date(),
     isLate: isLate
   }
```

**Unique constraint:** The database has a unique index on `{ assignment, student }` — one student can only have one submission per assignment. Re-submissions update the existing document.

### 9.3 Late Submission Handling

The system automatically determines if a submission is late:

```javascript
const isLate = assignment.dueDate
  ? new Date() > new Date(assignment.dueDate)
  : false;  // no due date = never late
```

If `allowLateSubmission` is `false` and the submission is late, it's rejected with a 403 error. If `allowLateSubmission` is `true`, the submission is accepted but marked with `isLate: true` — the teacher can see this flag.

### 9.4 Teacher Grading Flow

```
PUT /api/assignments/:id/submissions/:submissionId/grade
Body: { grade, feedback, evaluatedFile, showEvaluatedToStudent }
     ↓
1. Validate grade: 0 ≤ grade ≤ assignment.totalMarks
     ↓
2. Update submission:
   submission.grade = grade;
   submission.feedback = feedback || "";
   submission.gradedBy = req.user._id;
   submission.gradedAt = new Date();
     ↓
3. If evaluatedFile provided (marked copy):
   Upload to Cloudinary → save URL
   submission.evaluatedFileUrl = url;
   submission.showEvaluatedToStudent = showEvaluatedToStudent;
     ↓
4. Notify student: "Your assignment has been graded"
```

### 9.5 Publishing Results

```
PUT /api/assignments/:id/publish-result  { publish: true }
     ↓
1. Set assignment.isResultPublished = true
     ↓
2. Notify ALL enrolled students: "Results have been published for ${assignment.title}"
```

**Before results are published:** Students can see their submission (if they submitted) but cannot see their grade or feedback.

**After results are published:** Students can see their grade, feedback, and (optionally) the marked copy.

### 9.6 Result Sheet PDF Generation

**File:** `assignmentController.js` — uses PDFKit library

```
POST /api/assignments/:id/generate-result-sheet
     ↓
1. Get all enrolled students in the course
     ↓
2. Get all submissions for this assignment
     ↓
3. Build result rows: for each enrolled student:
   - If submitted + graded → show grade
   - If submitted + not graded → "Not Graded"
   - If not submitted → "Absent"
     ↓
4. Calculate stats: highest, lowest, average marks
     ↓
5. Generate PDF with:
   - Blue gradient header banner with course info
   - Assignment info box (title, due date, total marks)
   - 4 stat cards: Enrolled, Submitted, Absent, Graded
   - 3 metric boxes: Highest, Lowest, Average marks
   - Results table with columns: #, Student ID, Name, Marks
   - Color coding: green for graded, red for absent, yellow for not graded
     ↓
6. Upload PDF to Cloudinary → return URL
```

---

## 10. AI Quiz Generation System

### 10.1 How the AI Creates Quiz Questions

**Files:** `quizController.js` → `quizGeneratorService.js` → `ollamaService.js`

```
POST /api/quizzes/generate  { courseId, title, numQuestions: 10, difficulty: "medium", materialId: null }
(Teacher only)
     ↓
STEP 1: FIND MATERIALS
  - Get course to extract courseNo
  - Find all materials for that course
  - 3 fallback strategies:
    a. Exact courseNo match
    b. Look up courseNo from courseId
    c. Case-insensitive match
     ↓
STEP 2: GET ALL TEXT CHUNKS
  MaterialChunk.find({ materialId: { $in: materialIds } })
  → All chunks from all materials in this course
     ↓
STEP 3: SELECT DIVERSE CHUNKS (most important step)
  selectDiverseChunks(chunks, numQuestions + 2)
  → Selects 12 chunks (10 + 2 buffer for rejected questions)
     ↓
STEP 4: GENERATE QUESTIONS (one per chunk, sequential)
  For each chunk:
    a. Send chunk to Ollama with MCQ prompt
    b. Parse JSON response → { questionText, options, correctAnswer, explanation }
    c. GROUNDING CHECK: verify question terms appear in chunk
    d. If grounded → add to results; if not → reject and continue
  Until we have 10 valid questions (or run out of chunks)
     ↓
STEP 5: SAVE QUIZ (unpublished)
  Quiz.create({
    course, createdBy, title, questions,
    isPublished: false,  // Teacher reviews before publishing
    totalQuestions: questions.length
  })
```

### 10.2 Diverse Chunk Selection Algorithm

**File:** `quizGeneratorService.js → selectDiverseChunks()`

**The problem:** If we just pick the longest chunks, all questions might come from the same material (e.g., all from one PDF). We want questions spread across different topics.

**The algorithm:**
```
Input: 100 chunks from 4 materials, target = 12
     ↓
1. FILTER: Drop chunks shorter than 150 characters (too small for good questions)
     ↓
2. GROUP BY MATERIAL:
   Material A: [chunk1(800 chars), chunk2(600 chars), chunk3(400 chars)]
   Material B: [chunk4(700 chars), chunk5(500 chars)]
   Material C: [chunk6(900 chars), chunk7(300 chars)]
   Material D: [chunk8(650 chars)]
     ↓
3. SORT each group by chunk length descending
   (Longer chunks = more content = better for question generation)
     ↓
4. ROUND-ROBIN selection:
   Round 1: Pick longest from A(800), B(700), C(900), D(650) → 4 chunks
   Round 2: Pick next from A(600), B(500), C(300) → 3 chunks
   Round 3: Pick next from A(400) → 1 chunk
   ... continue until target reached
     ↓
Output: 12 chunks from across all 4 materials
```

This ensures questions are **spread across different materials** — giving a well-rounded quiz.

### 10.3 The LLM Prompt for Question Generation

The prompt sent to Ollama for each chunk:

```
[System]
You generate MCQ questions from provided CONTEXT text.
- ONLY use information explicitly stated in the CONTEXT
- Do NOT use outside knowledge
- Make questions test understanding, not just memorization
- Do NOT use quotation marks inside JSON string values

[User]
CONTEXT:
"Normalization is a systematic process of organizing data in a database to reduce
redundancy. The main forms are 1NF, 2NF, 3NF, and BCNF. First Normal Form (1NF)
requires that each column contains atomic values..."

Generate 1 multiple-choice question at medium difficulty.

Output JSON format:
{
  "questions": [{
    "questionText": "...",
    "options": ["A) ...", "B) ...", "C) ...", "D) ..."],
    "correctAnswer": 0,
    "explanation": "...",
    "difficulty": "medium"
  }]
}
```

**Settings:** Temperature 0.1, max 800 tokens, 5-minute timeout (quiz generation is slow).

### 10.4 Grounding Validation — Catching Hallucinations

**The problem:** The AI might generate a question about something mentioned in its training data but not in the actual chunk. This is a hallucination.

**How grounding validation works:**

```javascript
const isQuestionGrounded = (questionText, chunkText) => {
  // 1. Extract key terms from the question (4+ chars, not stop words)
  const signalWords = questionText
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 4 && !GROUNDING_STOP_WORDS.has(w));

  // 2. Check if ≥20% appear in the source chunk
  const chunkLower = chunkText.toLowerCase();
  const matchCount = signalWords.filter(w => chunkLower.includes(w)).length;
  const ratio = matchCount / signalWords.length;

  return ratio >= 0.20;  // At least 20% of key terms must appear
};
```

**Example:** If the AI generates "What is the Big-O complexity of quicksort?" but the chunk never mentions "quicksort" or "Big-O" → grounding check FAILS → question is rejected.

### 10.5 JSON Parsing with 4-Stage Fallback

LLMs don't always produce perfect JSON. The parsing has 4 fallback stages:

```
Stage 1: Direct JSON.parse(raw)
  → Works if the model returns clean JSON
     ↓ (if fails)
Stage 2: Try extracting the first JSON object with regex /{.*}/s
  → Works if the model adds explanation text around the JSON
     ↓ (if fails)
Stage 3: Find last complete question object in truncated response
  → Works if the response was cut off mid-JSON
     ↓ (if fails)
Stage 4: Regex field extraction (find "questionText", "options" etc. individually)
  → Last resort — assembles a question from fragments
```

**Validation after parsing:** Each question MUST have:
- Non-empty `questionText`
- Exactly 4 options
- `correctAnswer` between 0 and 3

Questions failing validation are silently dropped.

### 10.6 Manual Quiz Creation

Teachers can bypass AI and create quizzes manually:

```
POST /api/quizzes/manual  {
  courseId, title, description,
  questions: [
    { questionText, options: ["A","B","C","D"], correctAnswer: 2, explanation }
  ]
}
```

Same validation applies: 4 options, correctAnswer 0–3. The quiz is created as published immediately (no review step needed for manual).

### 10.7 Quiz Scheduling & Status

Teachers can set a time window for quiz availability:

```
PUT /api/quizzes/:id/schedule  { scheduledAt: "2026-03-15T10:00", availableUntil: "2026-03-15T11:00" }
```

**Status calculation:**
```javascript
const getScheduleStatus = (quiz) => {
  const now = new Date();
  if (quiz.scheduledAt && now < quiz.scheduledAt) return "upcoming";
  if (quiz.availableUntil && now > quiz.availableUntil) return "expired";
  return "available";
};
```

| Status | Meaning |
|--------|---------|
| upcoming | Before `scheduledAt` — students can see the quiz exists but can't take it |
| available | Between `scheduledAt` and `availableUntil` — students can take the quiz |
| expired | After `availableUntil` — quiz is closed |

### 10.8 Student Quiz Taking — Randomization System

**The problem:** If all students see questions in the same order with options in the same order, cheating is easy.

**Solution:** Deterministic randomization using the student's user ID as a seed.

```
Student opens quiz:
GET /api/quizzes/:id
     ↓
1. Generate seed from student's user ID + quiz ID:
   seed = djb2Hash(`${req.user._id}_${quiz._id}`)
   → e.g., seed = 2847593

2. Create a seeded random number generator (Linear Congruential Generator):
   function seededRandom() {
     seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF;
     return (seed >>> 0) / 0xFFFFFFFF;
   }

3. Shuffle question ORDER using this seeded random:
   questionOrder = [0, 1, 2, ... 9]  →  [7, 2, 9, 0, 5, ...]
   → Each student gets a DIFFERENT order
   → Same student always gets the SAME order (deterministic)

4. For EACH question, shuffle option ORDER:
   optionOrders[i] = [0, 1, 2, 3]  →  [2, 0, 3, 1]
   → Options A, B, C, D are rearranged differently for each student

5. Return shuffled questions (without correctAnswer field!)
```

**Why deterministic (seeded)?** So if the student refreshes the page, they see the same order. And if there's a dispute, we can reproduce the exact order the student saw.

### 10.9 Auto-Grading with Randomization Reversal

When the student submits answers, the system must reverse the randomization to grade correctly:

```
POST /api/quizzes/:id/submit  {
  answers: [
    { questionIndex: 0, selectedAnswer: 2 },  // "question 0" in shuffled order
    { questionIndex: 1, selectedAnswer: 1 },
    ...
  ],
  questionOrder: [7, 2, 9, 0, 5, ...],     // the order they saw
  optionOrders: [[2,0,3,1], [1,3,0,2], ...]  // option order per question
}
     ↓
For each answer:
  1. Map shuffled question index → original question index:
     originalQIndex = questionOrder[answer.questionIndex]
     // e.g., question 0 in shuffled order = question 7 in original
  
  2. Map shuffled option index → original option index:
     originalOption = optionOrders[answer.questionIndex][answer.selectedAnswer]
     // e.g., option 2 in shuffled order = option 3 in original
  
  3. Compare with correct answer:
     if (quiz.questions[originalQIndex].correctAnswer === originalOption)
       score++
     ↓
Calculate percentage: (score / totalQuestions) * 100
Save QuizAttempt with answers, score, percentage, timeTaken
```

---

## 11. Discussion Forum (Q&A)

### 11.1 How Posts, Replies, and Sub-Replies Work

**Files:** `discussionController.js` → `discussionModel.js`

The discussion system has 3 levels of nesting:

```
Discussion (the original question)
  └── Reply (a direct answer)
        └── Sub-Reply (a response to the answer)
```

**Discussion Model Schema:**
```
course       — ObjectId ref to Course
author       — ObjectId ref to User (who posted the question)
title        — String
content      — String (the question text)
attachments  — [{ fileName, fileUrl }]
links        — [String]
votes        — [{ user: ObjectId, value: 1 or -1 }]
status       — "open" | "solved"
replies      — [{
    user: ObjectId,
    content: String,
    attachments: [...],
    links: [...],
    votes: [...],
    isAccepted: Boolean,
    subReplies: [{
        user: ObjectId,
        content: String,
        createdAt: Date
    }]
}]
```

### 11.2 Voting System Implementation

Anyone enrolled in the course can upvote (+1) or downvote (-1) a discussion or reply:

```
POST /api/discussions/:id/vote  { value: 1 }  (or -1)
     ↓
1. Find any existing vote by this user:
   const existingVote = discussion.votes.find(v => v.user.equals(req.user._id))

2. If already voted with same value:
   → Remove the vote (toggle off)

3. If already voted with different value:
   → Change the vote (flip from upvote to downvote or vice versa)

4. If not voted yet:
   → Add new vote { user: req.user._id, value: 1 }

5. Save and return updated vote count
```

The same logic applies for voting on replies. The total vote score is the sum of all vote values.

### 11.3 Accepted Answers

Only the **original poster** (the person who asked the question) can mark a reply as accepted:

```
PUT /api/discussions/:id/replies/:replyId/accept
     ↓
1. Verify req.user._id === discussion.author
     ↓
2. Toggle acceptance:
   reply.isAccepted = !reply.isAccepted
     ↓
3. Update discussion status:
   if (reply.isAccepted) → discussion.status = "solved"
   if (!reply.isAccepted) → discussion.status = "open"
     ↓
4. Save
```

Accepted replies are visually highlighted in the frontend and the discussion is marked as "solved".

---

## 12. Events System

### 12.1 Event Creation & Registration

**Files:** `eventController.js` → `eventModel.js`, `eventRegistrationModel.js`

Teachers create events (workshops, competitions, etc.):
```
POST /api/events  { title, description, date, location, maxCapacity, type }
```

Students register for events:
```
POST /api/events/register  { eventId }
     ↓
1. Check event exists and hasn't passed
2. Check capacity: registrations.count < event.maxCapacity
3. Check not already registered
4. Create EventRegistration { event, student, status: "registered" }
```

### 12.2 Marks & Result Sheet

After the event, the teacher records marks for participants:
```
POST /api/events/:id/marks  { studentId, marks, remarks }
     ↓
Create/update EventMark { event, student, marks, remarks, markedBy }
```

The teacher can generate a PDF result sheet:
```
GET /api/events/:id/result-sheet-pdf
     ↓
Generate PDF with event details, participant list, marks, statistics
Upload to Cloudinary → return URL
```

---

## 13. Notification System

### 13.1 How Notifications Are Created (Non-Blocking)

**File:** `utils/notificationHelper.js`

The key design decision is that notifications are **non-blocking** — the main operation (like creating an announcement) completes and returns immediately, while notifications are sent in the background.

```javascript
// In announcementController.js after creating announcement:
notifyEnrolledStudents({
  courseId,
  type: "announcement",
  title: "New Announcement",
  message: `New announcement in ${courseTitle}`
}).catch(() => {});  // .catch() ensures errors don't crash the main flow
```

The `.catch(() => {})` means: "if notifications fail, don't crash — just ignore the error."

### 13.2 Bulk Notification with Optional Email

```javascript
export const notifyEnrolledStudents = async ({ courseId, type, title, message, link, metadata, sendEmailFlag }) => {
  // 1. Find all active enrollments for this course
  const enrollments = await Enrollment.find({ course: courseId, status: "active" }).lean();

  // 2. Create notification documents in bulk (one DB operation, not one per student)
  const docs = enrollments.map(e => ({
    recipient: e.student,
    type, title, message, link, metadata
  }));
  await Notification.insertMany(docs);
  //    ↑ insertMany is much faster than creating one by one

  // 3. Optionally send emails (non-blocking)
  if (sendEmailFlag) {
    const students = await User.find({ _id: { $in: studentIds } }, "name email").lean();
    for (const s of students) {
      sendEmail(s.email, title, message, { name: s.name, link }).catch(() => {});
    }
  }
};
```

### 13.3 All Notification Types

| Type | When Created | Who Receives |
|------|-------------|-------------|
| `material_upload` | Teacher uploads material | All enrolled students |
| `announcement` | Teacher posts announcement | All enrolled students |
| `comment` | Someone comments on a discussion | Discussion author |
| `assignment_created` | Teacher creates assignment | All enrolled students |
| `assignment_graded` | Teacher grades a submission | The specific student |
| `result_published` | Teacher publishes results | All enrolled students |
| `evaluated_script` | Marked copy uploaded | The specific student |
| `feedback_response` | Teacher responds to feedback | The student who submitted |
| `enrollment` | Student enrolls in course | The student |
| `course_invite` | Teacher invited as co-teacher | The invited teacher |
| `quiz_created` | New quiz in course | All enrolled students |
| `quiz_scheduled` | Quiz gets a schedule | All enrolled students |
| `quiz_published` | Quiz is published | All enrolled students |

---

## 14. Feedback System

### 14.1 Submission and Privacy Rules

**File:** `feedbackController.js` → `feedbackModel.js`

```
POST /api/feedbacks  { title, message, category, isPrivate, targetTeacher }
(Student only)
     ↓
Categories: "Missing Material", "Wrong Content", "Technical Issue", "Private Feedback", "Other"
     ↓
If isPrivate === true:
  → Must provide targetTeacher (ObjectId of the teacher)
  → Only visible to: the student, the target teacher, and admins
     ↓
If isPrivate === false:
  → Visible to all teachers and admins
```

**Feedback Model Schema:**
```
student        — ObjectId ref to User
title          — String
message        — String
category       — String (enum of 5 categories)
isPrivate      — Boolean, default false
targetTeacher  — ObjectId ref to User (only for private feedback)
status         — "pending" | "resolved"
response       — String (teacher's reply)
respondedBy    — ObjectId ref to User
resolvedAt     — Date
```

### 14.2 Teacher Response Flow

```
PUT /api/feedbacks/:id/respond  { response }
     ↓
1. Find feedback
2. Access check:
   - Admin → can respond to any feedback
   - Teacher + private feedback → must be the targetTeacher
   - Teacher + public feedback → can respond
     ↓
3. Update feedback:
   feedback.response = response;
   feedback.respondedBy = req.user._id;
   feedback.status = "resolved";
   feedback.resolvedAt = new Date();
     ↓
4. Notify the student via email: "Your feedback has been responded to"
```

### 14.3 Auto-Cleanup Cron Job

**File:** `utils/cleanupResolvedFeedbacks.js`

A **cron job** runs every hour and automatically deletes old resolved feedback:

```javascript
cron.schedule("0 * * * *", async () => {    // minute 0 of every hour
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const result = await Feedback.deleteMany({
    status: "resolved",
    resolvedAt: { $lte: oneDayAgo }     // resolved more than 24 hours ago
  });
});
```

This keeps the database clean — resolved feedback is temporary. Students and teachers have had time to see the response, and the record is cleaned up after 24 hours.

---

## 15. Admin Panel

### 15.1 User Management

**File:** `adminController.js`

Admins have full CRUD control over users:

```
GET    /api/admin/users          → List all users (paginated, search by name/email/role)
GET    /api/admin/users/:id      → Get single user details
POST   /api/admin/users          → Create a user manually (set any role)
PUT    /api/admin/users/:id      → Update user details (name, email, role)
DELETE /api/admin/users/:id      → Delete user and cascade:
                                    → Delete enrollments
                                    → Delete submissions
                                    → Delete quiz attempts
                                    → Delete notifications
                                    → Delete feedback
                                    → Delete chat sessions
```

### 15.2 Platform Statistics

**File:** `statsController.js`

```
GET /api/stats/admin  → Returns:
{
  totalUsers: Number (grouped by role),
  totalCourses: Number,
  totalMaterials: Number,
  totalAssignments: Number,
  totalSubmissions: { total, graded, pending },
  totalQuizzes: Number,
  pendingFeedback: Number,
  recentEnrollments: [...last 10],
}
```

Each stat is a separate MongoDB aggregation query, all run in the same endpoint.

---

## 16. Email Service Implementation

**File:** `utils/sendEmail.js`

The project sends emails via **Gmail SMTP** using the `nodemailer` library.

**Configuration:**
```javascript
const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,    // Gmail address
    pass: process.env.EMAIL_PASS     // App password (not regular password)
  }
});
```

**Two types of emails:**

1. **Plain text** — for OTP emails (just the code)
2. **Branded HTML** — for notification emails (with blue header, button, footer)

The HTML email template includes:
- Blue gradient header with "Student Aid System" branding
- Personalized greeting ("Dear [name]")
- Message content
- "See Details" button with link to the relevant page
- Footer with "Automated notification. Do not reply."

**Gmail App Password:** Since Gmail blocks "less secure apps", the project uses a Gmail App Password (configured in `.env` as `EMAIL_PASS`). This is a 16-character password generated from Google Account settings.

---

## 17. Profile & User Management

**File:** `userController.js`

**View profile:** Returns user data (minus password).

**Update profile:** Can change name. If avatar file uploaded → saved to local storage.

**Change password:**
```
PUT /api/users/change-password  { currentPassword, newPassword }
     ↓
1. Verify current password: bcrypt.compare(currentPassword, user.password)
   → If wrong → 400 "Current password is incorrect"
     ↓
2. Hash new password: bcrypt.hash(newPassword, salt)
     ↓
3. Save: user.password = hashed → user.save()
```

---

## 18. Database Models — Complete Schemas

Here are all 19 models with their exact fields:

**User:**
```
name, email (unique), password (bcrypt hash), role (student/teacher/admin),
idNumber (7-digit, unique), avatar, contributionScore,
isVerified, otp, otpExpiry, timestamps
```

**Course:**
```
courseNo (unique), title, description, department, semester,
courseCode (8-char random), createdBy (ref User), teachers [ref User], timestamps
```

**Material:**
```
title, courseTitle, courseNo, type (Lecture Notes/Slides/Book/etc.),
fileUrl, originalFileName, textContent, uploadedBy (ref User), timestamps
```

**MaterialChunk:**
```
materialId (ref Material), chunkText, embedding [Number], timestamps
```

**Enrollment:**
```
student (ref User), course (ref Course), status (active/dropped),
timestamps, unique index on {student, course}
```

**Announcement:**
```
course (ref), author (ref), title, content, isPinned,
attachments [{fileName, fileUrl, fileType}], links [String],
comments [{user, text, replies [{user, text}], createdAt, editedAt}], timestamps
```

**Assignment:**
```
course (ref), createdBy (ref), title, description, dueDate,
totalMarks, isPublished, isResultPublished, allowLateSubmission,
attachments [{fileName, fileUrl}], timestamps
```

**Submission:**
```
assignment (ref), student (ref), fileUrl, fileName, textContent,
submittedAt, isLate, grade, feedback, gradedBy (ref), gradedAt,
evaluatedFileUrl, showEvaluatedToStudent, timestamps,
unique index on {assignment, student}
```

**Quiz:**
```
course (ref), createdBy (ref), title, description,
questions [{questionText, options[4], correctAnswer(0-3), explanation, difficulty, sourceChunk}],
isPublished, timeLimit (minutes), totalQuestions,
scheduledAt, availableUntil, timestamps
```

**QuizAttempt:**
```
quiz (ref), student (ref), answers [{questionIndex, selectedAnswer}],
score, totalMarks, percentage, startedAt, completedAt, timeTaken (seconds),
questionOrder [Number], optionOrders (Mixed), timestamps,
unique index on {quiz, student}
```

**Discussion:**
```
course (ref), author (ref), title, content,
attachments, links, votes [{user, value: 1/-1}],
status (open/solved),
replies [{user, content, attachments, links, votes, isAccepted,
  subReplies [{user, content, createdAt}]}],
timestamps
```

**ChatSession:**
```
user (ref), title, isActive,
messages [{role, content, sources [{courseTitle, courseNo, type, fileUrl, relevance}],
  ragMetadata {queryType, complexity, attempt, bestScore, confidence,
    faithfulness, coverage, supported, evalReasoning, parseFailed},
  timestamp}],
timestamps
```

**Notification:**
```
recipient (ref User), type (enum), title, message, link,
isRead (bool), metadata (Mixed), timestamps
```

**Feedback:**
```
student (ref), title, message, category (enum),
isPrivate, targetTeacher (ref), status (pending/resolved),
response, respondedBy (ref), resolvedAt, timestamps
```

**SearchHistory:**
```
user (ref), query, resultsCount, filters { courseNo, type }, timestamps
```

**Event:**
```
title, description, date, location, maxCapacity, type,
createdBy (ref), course (ref, optional), timestamps
```

**EventRegistration:**
```
event (ref), student (ref), status (registered/cancelled), timestamps
```

**EventMark:**
```
event (ref), student (ref), marks (Number), remarks,
markedBy (ref), timestamps
```

**CourseInvitation:**
```
course (ref), invitedBy (ref User), invitedTeacher (ref User),
status (pending/accepted/rejected), timestamps
```

---

## 19. Frontend Architecture

### 19.1 Routing & Protected Routes

**File:** `frontend/src/router/AppRouter.js`

The frontend uses **React Router** to map URLs to page components:

```
/                    → LandingPage
/login               → Login
/register            → Register
/forgot-password     → ForgotPassword
/reset-password      → ResetPassword

(Protected — requires login)
/dashboard           → Student/Teacher/Admin Dashboard (based on role)
/courses             → Course list
/courses/:id         → Course detail (stream, materials, assignments, quizzes)
/materials           → Materials page
/search              → Semantic Search
/ai-tutor            → AI Chat
/notifications       → Notifications
/profile             → User profile
/feedback            → Feedback (student: submit, teacher: view)
/quiz/:id            → Take Quiz

(Teacher only)
/upload-material     → Upload Material
/create-assignment   → Create Assignment
/generate-quiz       → AI Quiz Generator

(Admin only)
/admin/users         → User Management
/admin/courses       → Course Management
/admin/feedbacks     → Feedback Management
/admin/dashboard     → Admin Statistics
```

**Protected Routes** use the `ProtectedRoute` component:
```
If not logged in → redirect to /login
If logged in but wrong role → redirect to /dashboard
If logged in and correct role → render the page
```

### 19.2 Auth Context & Token Management

**File:** `frontend/src/context/AuthContext.js`

The entire app is wrapped in an `AuthProvider` that manages login state:

```
AuthContext provides:
  - user         → the logged-in user object (or null)
  - token        → the JWT token (or null)
  - login(data)  → saves token + user to state + localStorage
  - logout()     → clears token + user from state + localStorage
  - isLoading    → true while checking if stored token is valid
```

On app startup:
1. Check `localStorage` for saved token
2. If found → validate by calling the API (`GET /api/users/me`)
3. If valid → set user state (user stays logged in across page refreshes)
4. If invalid/expired → clear token (user must log in again)

### 19.3 API Service Layer

**File:** `frontend/src/services/api.js` + individual service files

The frontend has a centralized API configuration:

```javascript
// api.js — Axios instance with base URL and auth interceptor
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:5000/api"
});

// Automatically attach JWT token to every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

Each feature has its own service file (e.g., `materialService.js`, `chatService.js`) that wraps API calls:

```javascript
// Example: materialService.js
export const getMaterials = (params) => api.get("/materials", { params });
export const uploadMaterial = (formData) => api.post("/materials", formData);
export const deleteMaterial = (id) => api.delete(`/materials/${id}`);
```

This keeps API calls organized and reusable — any component that needs to fetch materials imports from `materialService.js`.

### 19.4 Theme System

**File:** `frontend/src/context/ThemeContext.js`

The app supports dark and light mode:

```
ThemeContext provides:
  - mode         → "light" or "dark"
  - toggleTheme  → switches between modes
```

The preference is stored in `localStorage` so it persists across sessions. Material-UI's `ThemeProvider` applies the correct color palette globally.
