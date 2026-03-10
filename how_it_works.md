# How Every Feature Is Implemented — Plain English Explanation

> No code here — just clear, step-by-step explanations of how each feature works behind the scenes. Written so you can explain it to your teacher in your own words.

---

## Table of Contents

1. [Project Structure & How Everything Connects](#1-project-structure--how-everything-connects)
2. [Authentication & Security](#2-authentication--security)
   - [How Registration Works](#21-how-registration-works)
   - [How OTP Verification Works](#22-how-otp-verification-works)
   - [How Login Works](#23-how-login-works)
   - [How the System Knows Who You Are (JWT)](#24-how-the-system-knows-who-you-are-jwt)
   - [How Role-Based Access Control Works](#25-how-role-based-access-control-works)
   - [How Forgot Password Works](#26-how-forgot-password-works)
   - [How the System Detects Your Role from Email](#27-how-the-system-detects-your-role-from-email)
3. [Course Management](#3-course-management)
   - [How Course Creation Works](#31-how-course-creation-works)
   - [How the Course Code System Works](#32-how-the-course-code-system-works)
   - [How Co-Teacher Invitation Works](#33-how-co-teacher-invitation-works)
4. [Enrollment System](#4-enrollment-system)
   - [How Students Join a Course](#41-how-students-join-a-course)
   - [How Enrollment Controls What Students Can See](#42-how-enrollment-controls-what-students-can-see)
   - [How Unenrolling Works](#43-how-unenrolling-works)
5. [Material Upload & Processing Pipeline](#5-material-upload--processing-pipeline)
   - [The Full Journey of an Uploaded File](#51-the-full-journey-of-an-uploaded-file)
   - [How Text Is Extracted from Different File Types](#52-how-text-is-extracted-from-different-file-types)
   - [How Text Chunking Works](#53-how-text-chunking-works)
   - [How Embeddings Work (Converting Text to Numbers)](#54-how-embeddings-work-converting-text-to-numbers)
   - [How Files Are Stored in the Cloud](#55-how-files-are-stored-in-the-cloud)
6. [Semantic Search — Finding Relevant Materials](#6-semantic-search--finding-relevant-materials)
   - [The Complete Search Flow](#61-the-complete-search-flow)
   - [How Cosine Similarity Works (The Math Behind Search)](#62-how-cosine-similarity-works-the-math-behind-search)
   - [How Enrollment Restricts Search Results](#63-how-enrollment-restricts-search-results)
   - [How Results Are Scored, Grouped, and Ranked](#64-how-results-are-scored-grouped-and-ranked)
   - [How Search History and Autocomplete Work](#65-how-search-history-and-autocomplete-work)
7. [AI Tutor — The RAG Pipeline](#7-ai-tutor--the-rag-pipeline)
   - [What Is RAG and Why We Need It](#71-what-is-rag-and-why-we-need-it)
   - [Stage 1 — Query Analysis (No AI Needed)](#72-stage-1--query-analysis-no-ai-needed)
   - [Stage 2 — Adaptive Retrieval (Smart Chunk Fetching)](#73-stage-2--adaptive-retrieval-smart-chunk-fetching)
   - [Stage 3 — Answer Generation (Asking the AI)](#74-stage-3--answer-generation-asking-the-ai)
   - [Stage 4 — Self-Evaluation (AI Judges Its Own Answer)](#75-stage-4--self-evaluation-ai-judges-its-own-answer)
   - [Stage 5 — Decision Engine (Accept, Retry, or Reject)](#76-stage-5--decision-engine-accept-retry-or-reject)
   - [The Topic Relevance Gate — Preventing Wrong Answers](#77-the-topic-relevance-gate--preventing-wrong-answers)
   - [How Chat Sessions Are Managed](#78-how-chat-sessions-are-managed)
   - [How Ollama (Our Local AI) Works](#79-how-ollama-our-local-ai-works)
8. [Announcements & Class Stream](#8-announcements--class-stream)
   - [How Announcements Are Created and Delivered](#81-how-announcements-are-created-and-delivered)
   - [How Comments and Replies Work](#82-how-comments-and-replies-work)
   - [How Pinning and Ordering Work](#83-how-pinning-and-ordering-work)
9. [Assignment & Grading System](#9-assignment--grading-system)
   - [How Assignment Creation Works](#91-how-assignment-creation-works)
   - [How Student Submission Works](#92-how-student-submission-works)
   - [How Late Submission Is Handled](#93-how-late-submission-is-handled)
   - [How Grading Works](#94-how-grading-works)
   - [How Result Publishing Works](#95-how-result-publishing-works)
   - [How the PDF Result Sheet Is Generated](#96-how-the-pdf-result-sheet-is-generated)
10. [AI Quiz Generation System](#10-ai-quiz-generation-system)
    - [How the AI Creates Quiz Questions](#101-how-the-ai-creates-quiz-questions)
    - [How Diverse Chunk Selection Works](#102-how-diverse-chunk-selection-works)
    - [How the AI Prompt for Questions Works](#103-how-the-ai-prompt-for-questions-works)
    - [How Grounding Validation Catches Fake Questions](#104-how-grounding-validation-catches-fake-questions)
    - [How JSON Parsing Handles AI Mistakes](#105-how-json-parsing-handles-ai-mistakes)
    - [How Quiz Scheduling Works](#106-how-quiz-scheduling-works)
    - [How Quiz Randomization Prevents Cheating](#107-how-quiz-randomization-prevents-cheating)
    - [How Auto-Grading Reverses the Randomization](#108-how-auto-grading-reverses-the-randomization)
11. [Discussion Forum](#11-discussion-forum)
    - [How Posts, Replies, and Sub-Replies Work](#111-how-posts-replies-and-sub-replies-work)
    - [How Voting Works](#112-how-voting-works)
    - [How Accepted Answers Work](#113-how-accepted-answers-work)
12. [Events System](#12-events-system)
13. [Notification System](#13-notification-system)
    - [How Notifications Are Sent Without Slowing Things Down](#131-how-notifications-are-sent-without-slowing-things-down)
    - [How Bulk Notifications Work](#132-how-bulk-notifications-work)
14. [Feedback System](#14-feedback-system)
    - [How Feedback Submission and Privacy Work](#141-how-feedback-submission-and-privacy-work)
    - [How Teacher Response Works](#142-how-teacher-response-works)
    - [How the Automatic Cleanup Works](#143-how-the-automatic-cleanup-works)
15. [Admin Panel](#15-admin-panel)
16. [Email Service](#16-email-service)
17. [Profile Management](#17-profile-management)
18. [Frontend Architecture](#18-frontend-architecture)
    - [How Routing and Page Protection Work](#181-how-routing-and-page-protection-work)
    - [How Login State Is Remembered](#182-how-login-state-is-remembered)
    - [How the Frontend Talks to the Backend](#183-how-the-frontend-talks-to-the-backend)
    - [How Theme Switching Works](#184-how-theme-switching-works)

---

## 1. Project Structure & How Everything Connects

The project is split into two independent applications — a **backend** (Node.js server) and a **frontend** (React web app). They communicate over HTTP. The backend handles all the logic, data, and AI. The frontend is purely a visual interface.

Inside the backend, every incoming request follows a fixed path through four layers:

- **Routes** decide which URL goes where. They are like a receptionist — they look at the URL and direct the request to the right place.
- **Middleware** runs before the main logic. It checks things like "Is the user logged in?" and "Is the user allowed to do this?" and "Did they upload a file?". If any check fails, the request is rejected before it reaches the main logic.
- **Controllers** are the main logic. They receive the request, interact with the database, call AI services if needed, and send back a response.
- **Services** handle complex operations that controllers shouldn't be burdened with — things like the RAG pipeline, quiz generation, and embedding creation.
- **Models** define the shape of data stored in MongoDB. Every piece of data (users, courses, materials, etc.) has a model that says what fields it has and what type each field is.
- **Utils** are small helper functions used across the application — sending emails, parsing files, computing similarity, etc.

When the server starts, it connects to MongoDB first, then sets up all the routes, starts a background cleanup job for old feedback, and begins listening for requests.

---

## 2. Authentication & Security

### 2.1 How Registration Works

When a new user fills out the registration form and clicks submit, the system goes through these steps:

**Step 1:** The system looks at the user's email domain to automatically figure out their role. If the email ends with "stud.kuet.ac.bd", the user is a student. If it ends with "kuet.ac.bd" (without the stud part), the user is a teacher. If it ends with "admin.kuet.ac.bd", the user is an admin. Any other email domain is rejected — only KUET emails are allowed.

**Step 2:** The system checks whether this email is already registered and whether the 7-digit student/teacher ID is already taken. If either exists, registration is rejected.

**Step 3:** The password is never stored as plain text. Instead, the system uses a library called bcrypt to hash it. Hashing is a one-way mathematical transformation — you can turn a password into a hash, but you cannot turn the hash back into the password. A random "salt" (extra random characters) is mixed in before hashing, so even two users with the same password get different hashes. The cost factor is set to 10, meaning the hashing function runs 1024 internal rounds, making it slow enough to resist brute-force attacks.

**Step 4:** A 6-digit OTP (One-Time Password) is generated randomly and saved along with an expiry time of 10 minutes from now.

**Step 5:** The user's record is created in the database with "isVerified" set to false, and the OTP is sent to their email.

### 2.2 How OTP Verification Works

After registering, the user receives an email with a 6-digit code. They enter it on the verification page.

The system finds the user by email, checks if the OTP they entered matches the one stored in the database, and checks if the current time is still within the 10-minute window. If both checks pass, the user's account is marked as verified, and the OTP fields are cleared from the database. If the OTP has expired, the user must request a new one.

### 2.3 How Login Works

When a user enters their email and password and clicks login:

The system finds the user by email. If no user exists with that email, it returns "invalid credentials" without revealing whether the email or password was wrong (this is a security practice — not telling attackers which part was incorrect).

If the user is found, the system uses bcrypt to compare the entered password with the stored hash. Bcrypt re-hashes the entered password using the same salt that was used during registration and checks if the result matches.

If the password matches, the system creates a JWT (JSON Web Token). This token contains only the user's database ID, is signed with a secret key that only the server knows, and has a 1-hour expiry. The token is sent back to the frontend, which stores it and includes it in every future request.

### 2.4 How the System Knows Who You Are (JWT)

Every protected API endpoint runs a middleware function before executing. This middleware:

First, it looks at the request header for an "Authorization" field containing the word "Bearer" followed by the token. It also checks the URL query string as a fallback (used for file download links).

Then it verifies the token using the same secret key that was used to sign it. If anyone has tampered with the token or if it has expired, this verification fails and the request is rejected with a 401 error.

If verification succeeds, the middleware extracts the user ID from the token, loads that user's full profile from the database (excluding the password field for safety), and attaches it to the request object. From this point on, any code handling the request can access the logged-in user's details.

### 2.5 How Role-Based Access Control Works

After verifying who the user is, a second middleware can check their role. For example, when a student tries to upload a material (which only teachers can do), this middleware checks if the user's role is in the list of allowed roles. If the user is a student and the allowed roles are "teacher" and "admin", the request is rejected with a 403 Forbidden error.

This is implemented as a function that takes a list of allowed roles and returns a middleware function. The middleware simply checks if the current user's role is in that list.

### 2.6 How Forgot Password Works

This is a two-step process. In the first step, the user enters their email and requests a password reset. The system generates a new 6-digit OTP with a 10-minute expiry, saves it to the user's record, and emails it.

In the second step, the user enters the OTP and their new password. The system verifies the OTP and its expiry just like during registration. If valid, the new password is hashed with bcrypt and saved, and the OTP fields are cleared.

### 2.7 How the System Detects Your Role from Email

This is a simple utility function that looks at the email domain. It checks the email against specific KUET domain patterns. The "stud" subdomain means student, the base "kuet.ac.bd" domain means teacher, and the "admin" subdomain means admin. There are also a few hardcoded test emails for development purposes. If the email doesn't match any pattern, the function returns null and registration is rejected.

---

## 3. Course Management

### 3.1 How Course Creation Works

Only teachers and admins can create courses. When a teacher fills out the course creation form, the system first checks if a course with that course number already exists (course numbers must be unique, like "CSE305").

Then it generates a random 8-character alphanumeric code — this is the course's join code that students will use to enroll. The course is created in the database with the teacher listed as both the creator and in the teachers array.

### 3.2 How the Course Code System Works

The course code is similar to Google Classroom's class code. It's an 8-character random string made of letters and numbers. Students enter this code to join a course.

If a teacher wants to invalidate the old code (for example, if it was shared publicly by mistake), they can regenerate it. This creates a new random code and the old code stops working immediately.

### 3.3 How Co-Teacher Invitation Works

A course creator can invite another teacher to co-manage the course. The system creates an invitation record with status "pending" and notifies the invited teacher.

The invited teacher can accept or reject. If they accept, their user ID is added to the course's teachers array, giving them the same management permissions as the original creator — they can upload materials, create assignments, grade students, etc.

---

## 4. Enrollment System

### 4.1 How Students Join a Course

A student enters the 8-character course code on the enrollment page. The system looks up which course has that code. If the code is invalid, the request is rejected.

The system then checks if this student already has an enrollment record for this course. If they do and it's active, they get a "already enrolled" error. If they had previously dropped the course, their existing record is reactivated instead of creating a new one.

If everything is fine, a new enrollment record is created linking the student to the course with status "active". The database has a unique constraint on the combination of student and course, so it's impossible to have duplicate enrollments even if something goes wrong in the application logic.

### 4.2 How Enrollment Controls What Students Can See

This is one of the most important design patterns in the entire system. Almost every query in the system checks enrollment.

When a student requests anything — materials, assignments, quizzes, search results, announcements — the system first asks the database: "Which courses is this student actively enrolled in?" It gets back a list of course numbers.

Then, whatever the student is trying to access is filtered so they can only see items belonging to those courses. For example, when searching for materials, the query adds a condition that says "only return materials where the course number is in this student's enrolled course list."

Teachers and admins skip this filtering entirely — they have unrestricted access.

### 4.3 How Unenrolling Works

When a student drops a course, the enrollment record is not deleted. Instead, its status is changed from "active" to "dropped". This preserves the history and allows the student to re-enroll later without losing the record. When a dropped student re-enrolls, the status simply flips back to "active".

---

## 5. Material Upload & Processing Pipeline

### 5.1 The Full Journey of an Uploaded File

This is a multi-step pipeline and one of the most complex features. Here's what happens when a teacher uploads a PDF:

**Step 1 — File Reception:** The upload middleware (powered by a library called Multer) intercepts the incoming file from the form data and saves it temporarily on the server's local disk in an "uploads" folder. The maximum allowed file size is 50MB. Only PDF, DOCX, and PPTX files are accepted.

**Step 2 — Text Extraction:** The system detects the file type from its extension and calls the appropriate parser to pull out all the text. This gives us a plain text string containing everything written in the document.

**Step 3 — Cloud Upload:** The file is uploaded to Cloudinary (a cloud file storage service). Cloudinary returns a permanent URL where the file can be accessed. After the upload succeeds, the temporary file on the server is deleted.

**Step 4 — Database Record:** A Material document is created in MongoDB with the title, course info, Cloudinary URL, original filename, extracted text, and who uploaded it.

**Step 5 — Text Chunking:** The extracted text is split into smaller pieces of approximately 600 characters each. The splitting is done at sentence boundaries so no sentence is cut in half.

**Step 6 — Embedding Generation:** Each chunk is sent to an AI model (HuggingFace's BAAI/bge-small-en-v1.5) which converts the text into a list of 384 numbers. These numbers mathematically represent the meaning of the text. Two chunks about similar topics will produce similar number patterns.

**Step 7 — Chunk Storage:** Each chunk, along with its embedding (the 384 numbers), is saved as a separate document in MongoDB, linked back to the parent material.

**Step 8 — Student Notification:** All students enrolled in the course receive a notification that new material has been uploaded. This happens in the background — the teacher gets their success response immediately without waiting for all notifications to be sent.

### 5.2 How Text Is Extracted from Different File Types

For PDFs, the system uses a library called pdfjs-dist (the same technology Firefox uses to display PDFs). It opens the PDF, goes through each page one by one, extracts all the text items on each page, joins them together, and combines all pages into one text string.

For DOCX files (Microsoft Word), it uses a library called Mammoth that reads the .docx format (which is actually a ZIP file containing XML) and pulls out all the paragraph text, stripping away all formatting.

For PPTX files (PowerPoint), it uses a library called OfficeParser that reads the .pptx format and extracts text from all slides.

### 5.3 How Text Chunking Works

Imagine you have a 10-page document with 10,000 characters of text. If a student asks "What is normalization?", you don't want to search the entire document — you want to find the specific paragraph about normalization. That's why we split the text into smaller chunks.

The algorithm works like this: First, it splits the entire text into individual sentences by looking for periods, exclamation marks, and question marks followed by spaces. Then it starts building chunks by adding sentences one by one. If adding the next sentence would make the current chunk longer than 600 characters, the current chunk is saved and a new chunk is started.

If a single sentence is longer than 600 characters (rare, but possible), it's split into 600-character slices as a special case.

The important thing is that chunks respect sentence boundaries. A chunk never ends in the middle of a sentence, which makes each chunk a meaningful unit of text.

### 5.4 How Embeddings Work (Converting Text to Numbers)

An embedding is a way to represent text as a list of numbers that capture its meaning. The key property is that text about similar topics produces similar numbers.

For example, "Database normalization reduces redundancy" and "Normalizing data eliminates duplicate records" are different sentences but mean similar things. Their embeddings (lists of numbers) will be very similar — their numbers will follow a similar pattern.

The project uses the BAAI/bge-small-en-v1.5 model from HuggingFace, which is free. Each piece of text is sent to HuggingFace's API, which runs the model and returns 384 numbers. These 384 numbers are stored alongside each chunk in the database.

There's also an option to use OpenAI's embedding model instead (higher quality but costs money). The choice is made through an environment variable.

### 5.5 How Files Are Stored in the Cloud

Files are stored on Cloudinary, which is a cloud storage service. When a file is uploaded, it's sent to Cloudinary with automatic file type detection and stored in a folder called "student-aid/materials". Cloudinary returns a secure HTTPS URL that anyone can use to download the file.

When a material is deleted, the system also deletes the file from Cloudinary by extracting the file's unique identifier from its URL and calling Cloudinary's delete API.

The temporary file on the server is always cleaned up after the Cloudinary upload, whether the upload succeeded or failed.

---

## 6. Semantic Search — Finding Relevant Materials

### 6.1 The Complete Search Flow

When a student types a search query and hits enter, here's what happens step by step:

**Step 1 — Query Validation:** The system checks that the query is at least 3 characters long and contains at least one real word (with 2 or more letters). This prevents meaningless searches from wasting resources.

**Step 2 — Query Embedding:** The search query is converted into a list of 384 numbers using the exact same embedding model that was used for the material chunks. This is critical — because they use the same model, the query's numbers and the chunk's numbers are directly comparable.

**Step 3 — Access Control:** If the user is a student, the system first figures out which courses they're enrolled in. The search will only look at materials from those courses. Teachers and admins can search across everything.

**Step 4 — Fetch All Matching Chunks:** The system loads all material chunks from the database that belong to materials in the allowed courses.

**Step 5 — Score Every Chunk:** For each chunk, the system calculates a cosine similarity score between the query's embedding and the chunk's embedding. This score ranges from 0 (completely unrelated) to 1 (identical meaning).

**Step 6 — Filter Low Scores:** Any chunk with a similarity score below 0.35 is thrown away — it's not relevant enough to show.

**Step 7 — Take Top 50:** The remaining chunks are sorted by score (highest first) and only the top 50 are kept.

**Step 8 — Group by Material:** A single PDF might have 5 relevant chunks. Instead of showing the same PDF 5 times, the system groups chunks by their parent material. For each material, it keeps the highest score and up to 5 matching text excerpts.

**Step 9 — Return Top 20:** The grouped results are sorted by their best score and the top 20 materials are returned to the frontend.

**Step 10 — Save History:** The search query is saved to the search history database in the background (without blocking the response).

### 6.2 How Cosine Similarity Works (The Math Behind Search)

Cosine similarity measures how similar two lists of numbers are by looking at the angle between them when you imagine them as arrows in space.

Think of it this way: if you have two arrows pointing in exactly the same direction, even if one is longer than the other, the angle between them is 0 and the cosine of 0 is 1 (maximum similarity). If they point in completely different directions (perpendicular), the cosine is 0 (no similarity).

The formula takes two lists of numbers (the query embedding and the chunk embedding), computes three things: the dot product (multiply corresponding numbers and add them all up), the length of each list (square each number, add them up, take the square root), and then divides the dot product by the product of the two lengths.

The result is a number between 0 and 1. In practice, a score above 0.35 means "somewhat relevant" and above 0.7 means "very relevant".

We use cosine similarity instead of just measuring distance because it focuses on the direction of the vectors rather than their magnitude. This means a long detailed chunk and a short summary about the same topic will both score high when compared to a relevant query.

### 6.3 How Enrollment Restricts Search Results

For students, the system first queries the enrollment database to get a list of all courses the student is actively enrolled in. It extracts the course numbers from those enrollments.

Then, when fetching material chunks from the database, it adds a filter that says "only return chunks belonging to materials whose course number is in this list." This happens at the database query level, so chunks from courses the student isn't enrolled in are never even loaded into memory.

If the student also specifies a particular course in the search filter, the system verifies that they are enrolled in that course before applying the filter. If they're not enrolled, the filter is set to match nothing, returning zero results.

### 6.4 How Results Are Scored, Grouped, and Ranked

After every chunk has been scored against the query, the system removes all chunks scoring below 0.35 (too irrelevant). It then sorts by score and keeps only the top 50 (to keep processing fast).

Next comes grouping. Multiple chunks can come from the same material (one PDF might have many chunks). The system groups by material and for each material tracks: the highest score from any of its chunks, the material's metadata (title, course, file URL), and up to 5 matching chunk texts (which become "match previews" in the UI).

Finally, the grouped materials are sorted by their best score (highest first) and only the top 20 are returned. This gives the student a ranked list of the most relevant materials with preview snippets showing why each material matched.

### 6.5 How Search History and Autocomplete Work

Every time a student searches, the query text and the number of results are saved to a search history collection in the database. This saving happens asynchronously after the response is sent, so it doesn't slow down the search.

For autocomplete, when a student starts typing in the search box, the frontend sends the partial text to a suggestions endpoint. The system searches across three sources using text pattern matching: the student's recent search queries, course titles in the system, and material titles. It combines and deduplicates these suggestions, returning up to 10 matches.

---

## 7. AI Tutor — The RAG Pipeline

### 7.1 What Is RAG and Why We Need It

RAG stands for Retrieval-Augmented Generation. It solves a fundamental problem with AI chatbots: if you ask a regular AI "What is normalization?", it answers from its training data, which might not match what your professor teaches.

Our RAG system works differently. Instead of relying on the AI's training knowledge, it first finds the most relevant paragraphs from your actual uploaded course materials, then gives those paragraphs to the AI and tells it "answer the student's question using ONLY these paragraphs."

This way, every answer is grounded in your actual course materials. If the materials don't cover a topic, the AI honestly says "I don't have enough information" instead of making things up.

Our RAG pipeline has 5 stages: Query Analysis, Adaptive Retrieval, Answer Generation, Self-Evaluation, and Decision. Each stage is explained below.

### 7.2 Stage 1 — Query Analysis (No AI Needed)

Before talking to any AI (which is slow and expensive), we analyze the student's question using pure pattern matching — no AI call needed, so this stage is nearly instant.

**What type of question is it?** The system checks the question against predefined word patterns. Questions starting with "what is" or "define" are classified as factual. Questions with "how to" or "steps for" are procedural. Questions containing "compare", "vs", or "differences" are comparative. Questions with "why" or "reason" are causal. Very short questions (under 4 words) are marked as ambiguous. Everything else is conceptual.

**How complex is it?** The system scores complexity by checking: Is the question long (more than 20 words)? Does it have multiple clauses (commas)? Is it a comparison? Does it ask about multiple things ("and", "both")? Is it asking about causes? Each factor adds points, and the total determines if the question is simple, moderate, or complex.

**Can it be split into smaller searches?** For complex questions, the system generates sub-queries. For example, "Compare TCP and UDP" gets split into three searches: the original question, "TCP" alone, and "UDP" alone. "How to normalize a database" gets a variant like "steps for normalizing a database". This helps find more relevant chunks because different phrasings match different chunks.

**Initial confidence estimate:** Based on the question type and complexity, the system assigns a rough confidence score. Factual questions get a small boost (they're easier to answer), ambiguous questions get a penalty, and complex questions get a slight penalty.

### 7.3 Stage 2 — Adaptive Retrieval (Smart Chunk Fetching)

The key insight is that different types of questions need different retrieval strategies.

For a simple factual question like "What is 1NF?", you only need 3 highly relevant chunks, and you should be strict about relevance (minimum similarity of 0.50). Finding 3 great chunks is enough.

For a complex comparative question like "Compare normalization and denormalization techniques", you need more chunks (up to 8), and you should be more lenient about relevance (minimum 0.35) because a wider net catches more useful information.

The system uses a configuration table that maps complexity to three numbers: how many chunks to retrieve (topK), how relevant a chunk must be to keep it (threshold), and how low the best score can be before giving up entirely (noContextThreshold).

For simple questions: top 3 chunks, minimum 0.50 similarity, give up below 0.42.
For moderate questions: top 5 chunks, minimum 0.42 similarity, give up below 0.36.
For complex questions: top 8 chunks, minimum 0.35 similarity, give up below 0.30.

If the question was split into sub-queries, each sub-query is embedded separately and searched in parallel. The results from all sub-queries are merged together, removing duplicates (identified by the first 80 characters of the chunk text). When duplicates are found, the highest score is kept.

After merging, the chunks are sorted by score, filtered by the threshold, and capped at the topK limit.

If even the best-scoring chunk is below the noContextThreshold, the system knows there's truly nothing relevant in the database and stops immediately without asking the AI.

### 7.4 Stage 3 — Answer Generation (Asking the AI)

Now that we have the most relevant chunks, we build a prompt (instruction) for the AI.

The prompt has three parts:

**System instructions** tell the AI exactly how to behave. The rules are very strict: every sentence must be supported by the provided context, the AI must not use any knowledge from its training data, if it can't answer from the context it must say a specific fallback phrase, and the answer must be at most 3 sentences long.

**Context section** contains the retrieved chunks, each labeled with its course name and course number. Chunks are enclosed between clear markers so the AI knows exactly where the context starts and ends. Each chunk is truncated to 400 characters to keep the prompt short (small AI models struggle with long contexts).

**The question** is placed at the end with an instruction to answer based only on the context above.

This prompt is sent to Ollama (our local AI server running Mistral 7B). The temperature is set to 0.1 — very low, meaning the AI gives very deterministic, factual answers with almost no creativity. The maximum response length is 350 tokens. There's a 2-minute timeout in case the AI takes too long.

### 7.5 Stage 4 — Self-Evaluation (AI Judges Its Own Answer)

After getting an answer, we don't just blindly trust it. We ask the same AI to evaluate its own answer — a technique from AI research called "LLM-as-a-Judge."

The evaluator is given the original question, the retrieved context chunks (only the top 2, truncated to 400 characters each), and the generated answer. It's asked to score the answer on four dimensions:

**Faithfulness** (0.0 to 1.0): What fraction of the answer's claims are actually supported by the context? A score of 1.0 means everything in the answer came from the context.

**Coverage** (0.0 to 1.0): How much of the student's question was actually answered? A score of 0.5 means only half the question was addressed.

**Confidence** (0.0 to 1.0): How certain is the evaluator about its faithfulness and coverage scores?

**Supported** ("YES", "PARTIAL", or "NO"): An overall verdict on whether the answer is grounded in the context.

The evaluator is told to output these scores as a structured format. After receiving the scores, the system applies a calibration rule: confidence cannot be higher than coverage (the AI can't be very confident about an answer that barely covers the question).

If the AI's evaluation output is malformed (which happens sometimes with small models), the system has three levels of fallback for parsing it. If even the last level fails, safe default scores are used to ensure the pipeline never crashes.

There's also a fast shortcut: if the answer itself says "I don't have enough information" or similar phrases, the evaluator is skipped entirely and the system immediately returns that answer as valid.

### 7.6 Stage 5 — Decision Engine (Accept, Retry, or Reject)

Based on the evaluation scores, the system makes a final decision:

**Accept** if the confidence is at least 0.50 OR the faithfulness is at least 0.50, AND the supported verdict is not "NO". The answer passes quality control and is sent to the student.

**Retry** if the answer failed the check and we haven't used up our maximum of 2 retry attempts. When retrying, the system adds extra search phrases like "explain in detail" and "definition example" to the sub-queries, hoping to find better chunks on the second try. Then it goes back to Stage 2 and runs through the entire pipeline again with the expanded queries.

**Accept Best Effort** if retries are exhausted and the answer isn't terrible. Specifically, if the best retrieval score is at least 0.55, faithfulness is at least 0.40, and supported is not "NO", the answer is accepted as the best the system can do.

**Reject** if nothing worked — the system returns the standard fallback message: "I don't have enough information in the uploaded materials to answer this."

### 7.7 The Topic Relevance Gate — Preventing Wrong Answers

Between retrieval and answer generation, there's an important safety check called the topic relevance gate.

The problem it solves: Embedding models sometimes give misleadingly high similarity scores for unrelated topics. For example, a physics question about "force" might score well against a civil engineering chunk that also mentions "force" — but in a completely different context.

The gate works by extracting "signal words" from the question — words that are at least 5 characters long and are not common stop words (like "about", "which", "these"). Then it checks what percentage of those signal words actually appear in the retrieved chunks.

If less than 25% of the signal words appear in the chunks, the gate fails. The system immediately returns the "I don't have enough information" message without even asking the AI. This prevents the AI from receiving irrelevant context and generating a confidently wrong answer.

### 7.8 How Chat Sessions Are Managed

Each conversation with the AI tutor is stored as a "chat session" in the database. A session belongs to one user and contains a list of messages with timestamps.

When a student sends their first message, a new session is created. Subsequent messages in the same conversation are added to the same session. The title of the session is automatically set from the first message (truncated to 60 characters).

For context, the last 4 messages (2 from the student, 2 from the AI) are included when generating a new response. This gives the AI a sense of the conversation flow without overloading it with the entire history.

Every AI response is saved with full metadata: the query type, complexity, how many attempts were needed, the best retrieval score, confidence, faithfulness, coverage, the supported verdict, and any evaluation reasoning. This metadata is useful for debugging and analysis.

If the AI server (Ollama) is not running, the system returns a clear 503 error. If the AI takes too long, it returns a 504 timeout error.

### 7.9 How Ollama (Our Local AI) Works

Ollama is an application that runs AI language models on your own computer. Instead of sending data to OpenAI or Google, everything stays local — which is better for privacy and is completely free.

The project uses Mistral 7B, a 7-billion parameter language model. Ollama exposes a simple HTTP API on port 11434.

The system talks to Ollama through three different functions depending on the use case:

For generating answers, it uses the generate endpoint with very low temperature (0.1) for factual, deterministic responses. Responses are capped at 384 tokens. The system waits for the complete response before returning it.

For streaming responses (real-time typing effect), it uses the same endpoint but with streaming enabled and higher temperature (0.7) for more natural-sounding conversation.

For structured outputs (like self-evaluation scores and quiz questions), it uses the chat endpoint with JSON format enforced and temperature set to 0.0 (completely deterministic). The JSON format flag tells Ollama to only output valid JSON, which helps get parseable responses.

All requests have a 2-minute timeout. If Ollama doesn't respond within that time, the request is cancelled.

There's also a health check function that pings Ollama's API to see if it's running. This is used to give users a clear error message if the AI service is down.

---

## 8. Announcements & Class Stream

### 8.1 How Announcements Are Created and Delivered

When a teacher creates an announcement, the system first verifies they are the course creator, a co-teacher, or an admin. Any attached files are uploaded to Cloudinary.

The announcement is saved with the course reference, author, title, content, any file attachments (with file name, URL, and type), external links, and an empty comments array.

After saving, all enrolled students in that course receive a notification. This notification step happens in the background — the teacher gets their response immediately.

### 8.2 How Comments and Replies Work

Announcements support a two-level comment structure: comments on the announcement, and replies to comments.

When someone adds a comment, it's pushed into the announcement's comments array as a sub-document containing the user reference, the text, an empty replies array, and a timestamp.

When someone replies to a comment, the system first finds the specific comment by its ID within the announcement's comments array, then pushes the reply into that comment's replies array.

Deleting a comment removes it and all its replies in one operation.

### 8.3 How Pinning and Ordering Work

Teachers can pin important announcements. When fetching announcements for a course, the database query sorts by two fields: pinned status (pinned first) and creation date (newest first). This means pinned announcements always appear at the top of the list, and within each group (pinned and unpinned), newer announcements appear first.

---

## 9. Assignment & Grading System

### 9.1 How Assignment Creation Works

A teacher fills out the assignment form with a title, description, due date, total marks, whether late submissions are allowed, and optionally attaches files. Each attached file is uploaded to Cloudinary.

The assignment is created in the database with all these details, marked as published. All enrolled students in the course receive a notification about the new assignment.

### 9.2 How Student Submission Works

When a student submits their work, several checks happen first:

The system checks that the assignment results haven't already been published (no submissions after results are out). It verifies the student is enrolled in the course.

If the student already has a submission for this assignment, this counts as a re-submission — the existing record is updated rather than creating a new one. The database has a unique constraint on the combination of assignment ID and student ID, making duplicate records impossible.

The submitted file (if any) is uploaded to Cloudinary, and the submission record is created or updated.

### 9.3 How Late Submission Is Handled

The system automatically determines if a submission is late by comparing the current time to the assignment's due date. If no due date was set, a submission is never considered late.

If the submission is late and the teacher disabled late submissions for this assignment, the submission is rejected with an error. If the teacher allowed late submissions, the submission is accepted but flagged with a "late" marker that the teacher can see during grading.

### 9.4 How Grading Works

The teacher selects a submission and enters a grade and optional feedback. The system validates that the grade doesn't exceed the assignment's total marks.

The teacher can also upload an "evaluated file" — a marked copy of the student's work with annotations. This file is uploaded to Cloudinary, and the teacher can choose whether the student should be able to see it.

After saving the grade, the student receives a notification that their assignment has been graded.

### 9.5 How Result Publishing Works

Grading and publishing are separate steps. A teacher can grade submissions over time, and students don't see their grades until the teacher explicitly publishes results.

When the teacher publishes, a flag on the assignment is set to true, and all enrolled students receive a notification. After publishing, students can see their grades, feedback, and (if the teacher allowed it) the marked copy of their work.

After results are published, new submissions are no longer accepted.

### 9.6 How the PDF Result Sheet Is Generated

The system generates a professional PDF report using a library called PDFKit. Here's what it contains:

A blue gradient header banner with the course name and assignment title. An information box with the due date and total marks. Four statistics cards showing the number of enrolled students, submitted students, absent students, and graded students. Three metric boxes showing the highest, lowest, and average marks.

Then a full results table with columns for serial number, student ID, student name, and marks. Each row is color-coded: green for graded submissions, red for absent students, and yellow for students who submitted but haven't been graded yet.

The finished PDF is uploaded to Cloudinary and the URL is returned.

---

## 10. AI Quiz Generation System

### 10.1 How the AI Creates Quiz Questions

This is one of the most sophisticated features. The process works like this:

When a teacher requests quiz generation, they specify the course, number of questions, and difficulty level. The system finds all materials for that course using three fallback strategies: first by exact course number match, then by looking up the course number from the course ID, and finally by case-insensitive matching.

All text chunks from those materials are loaded from the database. Then the diverse chunk selection algorithm picks chunks that cover different materials. Each selected chunk is sent to the AI one at a time with a prompt asking it to create a multiple-choice question. The AI's response is parsed and validated. A grounding check ensures the question is actually about content in the chunk. Valid questions are collected until the target number is reached or all chunks are exhausted.

The generated quiz is saved as unpublished so the teacher can review the questions before making them available to students.

### 10.2 How Diverse Chunk Selection Works

If you just picked the biggest chunks, all questions might come from one PDF. To ensure variety, the system uses a round-robin approach.

First, chunks shorter than 150 characters are removed (too small for meaningful questions). The remaining chunks are grouped by which material they came from. Within each group, chunks are sorted by length (longest first, since longer chunks have more content for question generation).

Then the system picks chunks in rounds: one from each material per round, cycling through materials until enough chunks are collected. For example, if there are 4 materials and you need 12 chunks, you'd get 3 from each material (4 materials × 3 rounds = 12 chunks).

### 10.3 How the AI Prompt for Questions Works

Each chunk is sent to the AI with clear instructions: create a multiple-choice question at the specified difficulty, use only information from the provided text, don't use outside knowledge, include exactly 4 options with one correct answer, and provide an explanation.

The AI is told to output in a specific structured format with the question text, four options, which option is correct (as a number 0-3), the explanation, and the difficulty level.

The temperature is set very low (0.1) so the AI generates focused, factual questions rather than creative ones. The timeout is 5 minutes per question because quiz generation is computationally intensive.

### 10.4 How Grounding Validation Catches Fake Questions

After the AI generates a question, the system performs a grounding check to catch hallucinated questions — questions about topics not actually in the source material.

The grounding validator extracts key words from the generated question (words at least 4 characters long, excluding common words like "which", "following", "correct", etc.). Then it checks what percentage of those key words actually appear in the source chunk text.

If less than 20% of the key words are found in the chunk, the question is considered ungrounded — the AI made up something that isn't in the material. The question is rejected and the system moves on to the next chunk.

### 10.5 How JSON Parsing Handles AI Mistakes

Small AI models like Mistral 7B don't always produce perfectly formatted output. The system has four levels of fallback for parsing the AI's response:

Level 1: Try to parse the raw response directly as a structured format. This works when the AI follows instructions perfectly.

Level 2: If that fails, try stripping away any extra text the AI added around the structured part (like explanatory sentences) and extract just the data portion.

Level 3: If the response was cut off mid-sentence (happens when the AI hits the token limit), try to find the last complete question in the partial output.

Level 4: As a last resort, search for individual fields (question text, options, correct answer) using pattern matching and assemble a question from the fragments.

After parsing, each question must pass validation: it needs a non-empty question, exactly 4 options, and a correct answer between 0 and 3. Questions failing validation are silently dropped.

### 10.6 How Quiz Scheduling Works

Teachers can set a start time and end time for a quiz. The system calculates the quiz's status based on the current time: "upcoming" if the current time is before the start time, "available" if between start and end, and "expired" if after the end time.

Students can see upcoming quizzes but can't take them until the start time. Once expired, no more attempts are accepted.

### 10.7 How Quiz Randomization Prevents Cheating

If all students see the same questions in the same order with the same option arrangement, cheating by sharing answers is easy. The system prevents this with deterministic randomization.

When a student opens a quiz, the system generates a seed number by combining the student's unique ID and the quiz's unique ID through a hash function. This seed drives a pseudo-random number generator that shuffles the question order and, within each question, the option order.

The word "deterministic" is key: the same student opening the same quiz always sees the same order. This is important because if they refresh the page, their shuffled order shouldn't change. And if there's ever a dispute, the exact order can be reproduced.

Each student gets a different order because their unique ID is different, even though the randomization process is the same.

The correct answer field is removed from the data sent to the student — they never see which option is correct until after submission.

### 10.8 How Auto-Grading Reverses the Randomization

When a student submits their answers, we need to map their shuffled answers back to the original question order to grade them correctly.

The student's submission includes the shuffled question order and the shuffled option order for each question. For each answer, the system:

First, maps the shuffled question number back to the original question number. For example, if question 0 in the shuffled order was originally question 7, it looks at original question 7.

Second, maps the shuffled option number back to the original option number. For example, if the student selected option 2 in the shuffled view, but that was originally option 3, it checks option 3.

Third, compares the mapped option number with the correct answer stored in the original quiz.

The final score is calculated as a percentage of correct answers. A quiz attempt record is saved with the answers, score, percentage, and time taken.

---

## 11. Discussion Forum

### 11.1 How Posts, Replies, and Sub-Replies Work

The discussion system has three levels: discussion posts (the main questions), replies (direct answers to the post), and sub-replies (responses to specific replies).

A discussion post belongs to a course and is created by any enrolled user. It has a title, content, optional attachments and links, a voting system, a status (open or solved), and a list of replies.

Each reply also has its own voting system and can be marked as accepted. Sub-replies are simpler — just a user, content, and timestamp.

### 11.2 How Voting Works

Any enrolled user can upvote (+1) or downvote (-1) a discussion post or a reply.

When a user votes, the system checks if they've already voted. If they voted with the same value (clicking upvote when already upvoted), the vote is removed (toggle off). If they voted with a different value (clicking upvote when they had downvoted), the vote is changed. If they haven't voted yet, a new vote is added.

This means each user can have at most one vote per post or reply, and clicking the same button twice toggles it off.

### 11.3 How Accepted Answers Work

Only the person who created the discussion post can mark a reply as the accepted answer. When they do, the reply is flagged as accepted, and the discussion's status changes to "solved." If they un-accept it (toggle off), the status goes back to "open."

---

## 12. Events System

Teachers can create events like workshops, competitions, or seminars with details like title, description, date, location, maximum capacity, and type.

Students can register for events. The system checks that the event hasn't passed, there's still capacity (number of registrations is less than max capacity), and the student isn't already registered.

After an event, the teacher can record marks for each participant and add remarks. The system can generate a PDF result sheet with event details, participant list, marks, and statistics — similar to the assignment result sheet.

---

## 13. Notification System

### 13.1 How Notifications Are Sent Without Slowing Things Down

A critical design decision is that notifications are "non-blocking" — they happen in the background. When a teacher uploads material, for example, the upload process finishes and returns a success response to the teacher immediately. The notifications to students are sent afterwards, independently.

If the notification process fails for any reason (database error, email failure), it doesn't crash the main operation. Any errors are silently caught and ignored. This means uploading material will never fail just because a notification couldn't be sent.

### 13.2 How Bulk Notifications Work

When something happens that affects an entire class (like a new announcement), the system needs to notify every enrolled student. Instead of creating notification records one at a time (which would be slow for a class of 100+ students), it creates all notification documents in a single bulk database operation. This is much faster because it's one database call instead of 100+.

If email notifications are also requested, the system loads all student email addresses and sends emails individually. Email sending is also non-blocking — each email is fired off independently and errors are silently caught.

The system generates notifications for many different events: material uploads, announcements, assignment creation, assignment grading, result publishing, marked copy uploads, feedback responses, enrollment confirmations, co-teacher invitations, quiz creation, quiz scheduling, and quiz publishing.

---

## 14. Feedback System

### 14.1 How Feedback Submission and Privacy Work

Students can submit feedback in five categories: Missing Material, Wrong Content, Technical Issue, Private Feedback, and Other.

Feedback can be public or private. Public feedback is visible to all teachers and admins. Private feedback requires specifying a particular teacher and is only visible to that teacher, the student who submitted it, and admins.

### 14.2 How Teacher Response Works

When a teacher responds to feedback, access control is checked first. Admins can respond to any feedback. For private feedback, only the targeted teacher can respond. For public feedback, any teacher can respond.

The teacher's response is saved, the feedback status changes from "pending" to "resolved", and the timestamp is recorded. The student who submitted the feedback receives a notification email that their feedback has been addressed.

### 14.3 How the Automatic Cleanup Works

A cron job (scheduled background task) runs every hour, at the top of the hour. It searches for feedback that has been resolved for more than 24 hours and deletes it.

This keeps the database clean. The reasoning is that once feedback has been resolved and both parties have had a day to see the response, the record is no longer needed.

---

## 15. Admin Panel

Admins have full control over user management. They can list all users with search and pagination, view individual user details, create users manually (with any role), update user information, and delete users.

Deleting a user cascades to related records — the system also removes their enrollments, assignment submissions, quiz attempts, notifications, feedback records, and chat sessions.

The admin dashboard shows platform-wide statistics: total users grouped by role, total courses, total materials, total assignments, submission counts (total, graded, pending), total quizzes, pending feedback count, and recent enrollments.

---

## 16. Email Service

The project sends emails through Gmail's SMTP service using a library called Nodemailer. The Gmail account credentials are stored in environment variables.

There are two types of emails. Simple plain text emails are used for OTP codes. Branded HTML emails with a blue gradient header, personalized greeting, message content, a "See Details" button, and a footer are used for notifications.

Since Gmail blocks regular app access for security, the project uses a Gmail App Password — a special 16-character password generated from Google Account settings specifically for apps.

---

## 17. Profile Management

Users can view their profile (all fields except the password are returned) and update their name or avatar. Avatars are saved as files.

For changing passwords, the user must provide their current password, which is verified using bcrypt comparison. If correct, the new password is hashed and saved. This prevents someone who gained access to an unlocked computer from changing the password without knowing the old one.

---

## 18. Frontend Architecture

### 18.1 How Routing and Page Protection Work

The frontend uses React Router to map URLs to page components. Each URL like "/dashboard", "/courses", "/search" etc. shows a different page.

Protected routes use a wrapper component that checks two things: Is the user logged in? If not, redirect to the login page. Does the user have the right role? If a student tries to access an admin page, they're redirected to their own dashboard.

### 18.2 How Login State Is Remembered

The entire frontend is wrapped in an authentication context provider that manages login state. When a user logs in, their token and profile are saved both in the application's memory and in the browser's local storage.

When the app starts (or the page is refreshed), it checks local storage for a saved token. If found, it calls the backend to verify the token is still valid. If yes, the user stays logged in without needing to re-enter credentials. If the token has expired or is invalid, it's cleared and the user must log in again.

### 18.3 How the Frontend Talks to the Backend

The frontend has a centralized HTTP client configured with the backend's base URL. An interceptor automatically attaches the JWT token to every outgoing request by adding it to the Authorization header.

Each feature area (materials, chat, assignments, etc.) has its own service file that wraps the HTTP calls into simple function calls. This keeps the code organized — any component that needs to fetch materials imports from the materials service file, and the actual HTTP details are hidden away.

### 18.4 How Theme Switching Works

The app supports light and dark mode. The current preference is stored in a theme context and persisted in the browser's local storage. When the user toggles the theme, the context updates, local storage is updated, and Material-UI's theme provider applies the correct color palette to every component on the page immediately.
