# Student-Aid-Semantic-Search — Scaling Plan

> **Project Goal**: Build an upgraded version of Google Classroom for KUET students, with AI-powered features that go beyond what Classroom offers.
>
> **Team**: Jony  & Niloy 
>
> **Timeline**: ~1/2 weeks 
>
> **GitHub Repo**: https://github.com/System-Project-3-2/Student-Aid-Semantic-Search

---

## 📋 Table of Contents

1. [Current State Assessment](#current-state-assessment)
   - [✅ What's Already Built](#-whats-already-built)
   - [❌ What Google Classroom Has That We're Missing](#-what-google-classroom-has-that-were-missing)
   - [🌟 Selling Points](#-selling-points-features-google-classroom-doesnt-have)

2. [Phase Overview](#phase-overview)

3. [Phase 0: Existing Feature Improvements](#phase-0-existing-feature-improvements)
   - [🔴 Critical Fixes](#-critical-fixes)
   - [🟡 Important Improvements](#-important-improvements)
   - [🟢 Nice-to-Have Polish](#-nice-to-have-polish)

4. [Phase 1: Course Enrollment System](#phase-1-course-enrollment-system)

5. [Phase 2: Announcements & Class Stream](#phase-2-announcements--class-stream)

6. [Phase 3: Assignment & Grading System](#phase-3-assignment--grading-system)

7. [Phase 4: In-App Notification System](#phase-4-in-app-notification-system)

8. [Phase 5: AI Quiz Generation from Materials](#phase-5-ai-quiz-generation-from-materials)

9. [Phase 6: AI Summarization, Bookmarks & Study Analytics](#phase-6-ai-summarization-bookmarks--study-analytics)

10. [Execution Order & Dependencies](#execution-order--dependencies)

11. [Git Workflow](#git-workflow)

12. [Prompt Templates](#prompt-templates)

13. [Risk Mitigation](#risk-mitigation)

14. [Files That Will Be Created](#files-that-will-be-created-new)

15. [Summary Table](#summary-table)

---

## Current State Assessment

### ✅ What's Already Built 

| Feature | Backend | Frontend | Status |
|---|---|---|---|
| JWT Authentication (Register, Login) | ✅ | ✅ | Working |
| OTP Email Verification | ✅ | ✅ | Working |
| Password Reset (Forgot/Reset) | ✅ | ✅ | Working |
| Role-based Authorization (Student/Teacher/Admin) | ✅ | ✅ | Working |
| Material Upload (PDF, DOCX, PPTX) + Text Extraction | ✅ | ✅ | Working |
| Semantic Search (HuggingFace embeddings + Cosine Similarity) | ✅ | ✅ | Working |
| RAG-based AI Tutor (Ollama + Self-Evaluation pipeline) | ✅ | ✅ | Working |
| Course Management (CRUD) | ✅ | ✅ | Working |
| Feedback System (Submit, Respond, Email Notify) | ✅ | ✅ | Working |
| Admin Panel (User CRUD, Stats) | ✅ | ✅ | Working |
| File Storage (Cloudinary) | ✅ | ✅ | Working |
| Pagination (Materials, Courses, Users, Feedbacks) | ✅ | ✅ | Working |
| Search History & Autocomplete | ✅ | ✅ | Working |
| Dashboard Stats (Admin/Teacher/Student) | ✅ | ✅ | Working |
| Profile Management | ✅ | ✅ | Working |
| Dark/Light Theme Toggle | — | ✅ | Working |
| Auto-cleanup of Resolved Feedbacks (Cron) | ✅ | — | Working |
| Landing Page | — | ✅ | Working |
| File Preview Dialog | — | ✅ | Working |
| Signed URL for Cloudinary Files | ✅ | ✅ | Working |

### ❌ What Google Classroom Has That We're Missing

| Google Classroom Feature | Priority | Notes |
|---|---|---|
| **Course Enrollment** (Students join specific courses) | 🔴 Critical | Currently all students see all materials. No concept of "joining" a course. |
| **Announcements / Class Stream** | 🔴 Critical | Teachers can't post text announcements to their students. |
| **Assignments** (Create, Submit, Grade) | 🔴 Critical | No assignment/homework system at all. |
| **In-App Notifications** | 🟡 Important | No bell icon, no real-time or in-app notification center. |
| **Comments / Discussions** | 🟡 Important | Students can't discuss on materials or announcements. |
| **Material Organization by Topics** | 🟢 Nice | Materials aren't grouped into topics/modules within courses. |

### 🌟 Selling Points (Features Google Classroom Doesn't Have)

| Feature | Status | Wow Factor |
|---|---|---|
| Semantic Search across all materials | ✅ Already built | ⭐⭐⭐⭐ |
| RAG-based AI Tutor (Ollama local LLM) | ✅ Already built | ⭐⭐⭐⭐⭐ |
| **AI Quiz Generation from Materials** | ❌ Not built | ⭐⭐⭐⭐⭐ |
| **AI Material Summarization** | ❌ Not built | ⭐⭐⭐⭐ |
| **Bookmark / Save Materials** | ❌ Not built | ⭐⭐⭐ |
| **Study Analytics Dashboard** | ❌ Not built | ⭐⭐⭐⭐ |

---

## Phase Overview

| Phase | Name | Assigned To | Branch Name | Prompt By | Est. Time |
|---|---|---|---|---|---|
| **Phase 0** | Existing Feature Improvements | **Jony** | `fix/existing-improvements` | Jony | 1 day |
| **Phase 1** | Course Enrollment System | **Jony** | `feature/course-enrollment` | Jony | 2 days |
| **Phase 2** | Announcements & Class Stream | **Jony** | `feature/announcements` | Jony | 1.5 days |
| **Phase 3** | Assignment & Grading System | **Niloy** | `feature/assignments` | Niloy | 2.5 days |
| **Phase 4** | In-App Notification System | **Jony** | `feature/notifications` | Jony | 1.5 days |
| **Phase 5** | AI Quiz Generation from Materials | **Niloy** | `feature/ai-quiz` | Niloy | 2 days |
| **Phase 6** | AI Summarization, Bookmarks & Analytics | **Jony** | `feature/ai-summary-bookmarks` | Jony | 2 days |

**Total**: ~12.5 days → fits within the 2-week window.

---

## Phase 0: Existing Feature Improvements

**Assigned to: Jony** | **Branch: `fix/existing-improvements`** |

### Why This Is First
Several existing features have bugs or UX gaps that will undermine the project demo and break user trust. These must be fixed **before** building new features on top of them.

### 🔴 Critical Fixes

#### 1. Search Results Show No Title or Course Name (BUG)

**Problem**: When a student searches for materials, the `MaterialCard.js` component renders `material.title` and `material.course`, but the backend search API (`searchController.js`) returns fields named `courseTitle` and `courseNo`. This field-name mismatch causes the material title and course chip to be **blank/undefined** — only the type badge (e.g., "Slides") is visible.

**Root Cause**: The `MaterialCard.js` component was written to display generic `material.title` and `material.course`, but the `semanticSearch` controller groups results using `courseTitle` and `courseNo` from the Material model.

**Fix (Backend — `searchController.js`)**:
- In the `grouped` object, add `title: item.courseTitle` and `course: item.courseNo` as aliases so the frontend card can read them
- OR add the original filename/public_id from Cloudinary to the search result for display

**Fix (Frontend — `MaterialCard.js`)**:
- Update the component to read `material.courseTitle || material.title` and `material.courseNo || material.course` so it works for both search results and the Materials page context

**Files to change**:
- `backend/controllers/searchController.js` — add `title` and `course` fields to grouped results
- `frontend/src/components/common/MaterialCard.js` — make field access resilient to both naming conventions

#### 2. Search Course Filter Uses Hardcoded List Instead of Real Courses

**Problem**: `SearchMaterials.js` has a hardcoded `COURSES` array (`['Computer Science', 'Mathematics', ...]`) for the course filter dropdown. These don't match actual courses in the database (which use `courseNo` like "CSE101").

**Fix**:
- On component mount, fetch actual courses via `courseService.getAllCourses()` (API already exists)
- Populate the course filter dropdown with real course data (`courseNo` — `courseTitle`)
- Same fix for `MATERIAL_TYPES` — fetch distinct types from the materials API or keep as static but ensure they match the upload form

**Files to change**:
- `frontend/src/pages/student/SearchMaterials.js` — replace hardcoded arrays with API-fetched data

### 🟡 Important Improvements

#### 3. Add File Preview Button to Search Results

**Problem**: Search result cards have a Download button but no Preview button. The `FilePreviewDialog` component exists and works well on the Materials page, but is not wired up in search results.

**Fix**:
- Add a "Preview" button next to Download on `MaterialCard.js`
- Import and use `FilePreviewDialog` in `SearchMaterials.js`
- Pass material data to the dialog on click

**Files to change**:
- `frontend/src/components/common/MaterialCard.js` — add Preview button
- `frontend/src/pages/student/SearchMaterials.js` — add FilePreviewDialog state and rendering

#### 4. Upload Form Needs Course Autocomplete from Existing Courses

**Problem**: The Upload Material form (`UploadMaterial.js`) has free-text fields for Course Title and Course Number. Teachers may type inconsistent names (e.g., "Data Structures" vs "Data Structure" vs "data structures"), leading to fragmented course groups on the Materials page.

**Fix**:
- Fetch existing courses on mount and provide autocomplete suggestions for Course Title and Course Number fields
- Use MUI `Autocomplete` component with `freeSolo` so teachers can still type new names
- When selecting an existing course, auto-fill the other field (e.g., selecting "CSE101" auto-fills "Introduction to Data Structures")

**Files to change**:
- `frontend/src/pages/teacher/UploadMaterial.js` — replace TextField with Autocomplete for course fields

#### 5. Edit Material Dialog Has Mismatched Type Options

**Problem**: The `EditMaterialDialog` (in `Materials.js`) has hardcoded types: `['Lecture', 'Assignment', 'Notes', 'Presentation', 'Reference', 'Other']` which are different from the upload page types: `['Lecture Notes', 'Assignment', 'Lab Report', 'Book', 'Slides', 'Other']`. This means editing a material could change its type to something inconsistent.

**Fix**:
- Use the same `MATERIAL_TYPES` constant in both the upload and edit forms
- Extract into a shared constants file or import from a common location

**Files to change**:
- `frontend/src/pages/shared/Materials.js` — update `EditMaterialDialog` type options to match upload types

#### 6. Download Filename Is Not Meaningful

**Problem**: When downloading from `MaterialCard.js`, the download filename falls back to `material.courseTitle || material.courseNo` which gives names like "Introduction to Data Structures" with no file extension. The Materials page download handler extracts from URL path but both approaches are imperfect.

**Fix**:
- Store original filename (`originalFileName`) in the Material model when uploading
- Backend: save `file.originalname` from multer to the material document
- Frontend: use `material.originalFileName` as the download name, falling back to URL-derived name

**Files to change**:
- `backend/models/materialModel.js` — add `originalFileName` field
- `backend/controllers/materialController.js` — save `req.file.originalname` during upload
- `frontend/src/components/common/MaterialCard.js` — use `originalFileName` for download name
- `frontend/src/pages/shared/Materials.js` — use `originalFileName` in download handler

#### 7. Student Dashboard Missing AI Tutor Quick Action

**Problem**: The student dashboard has quick actions for Search, Submit Feedback, My Feedbacks, and All Materials — but no quick action for AI Tutor, which is the project's biggest selling point.

**Fix**:
- Add "AI Tutor" as the first item in the `quickActions` array with the `SmartToy` icon

**Files to change**:
- `frontend/src/pages/student/Dashboard.js` — add AI Tutor to quickActions

### 🟢 Nice-to-Have Polish

#### 8. Materials Page Has No Pagination

**Problem**: The Materials page (`Materials.js`) fetches ALL materials at once and only has client-side filtering. As materials grow, this will slow down.

**Fix**:
- Add server-side pagination to `GET /api/materials` (backend already supports `page` and `limit` query params in some routes)
- Use `PaginationControl` component (already exists) on the Materials page
- Load materials page-by-page instead of all at once

**Files to change**:
- `backend/controllers/materialController.js` — add pagination to `getAllMaterials`
- `frontend/src/pages/shared/Materials.js` — add pagination state and UI

#### 9. Search Similarity Score Not Shown to User

**Problem**: The backend computes cosine similarity scores for each result, but this information is discarded during grouping. Showing a relevance percentage would help users judge result quality.

**Fix**:
- In `searchController.js`, include the best (max) similarity score per grouped material
- In `MaterialCard.js`, display a "Relevance: 92%" chip or progress bar

**Files to change**:
- `backend/controllers/searchController.js` — add `relevanceScore` to grouped results
- `frontend/src/components/common/MaterialCard.js` — render relevance indicator

#### 10. Profile Page Has No Avatar

**Problem**: The profile page shows name, email, and role but no profile picture/avatar. Other parts of the UI (like the Navbar) could benefit from showing user avatars.

**Fix**:
- Add `avatar` field to User model (store Cloudinary URL)
- Add avatar upload section to Profile page using existing Cloudinary upload infrastructure
- Display avatar in Navbar user menu and profile page

**Files to change**:
- `backend/models/userModel.js` — add `avatar` field
- `backend/controllers/userController.js` — add avatar upload endpoint
- `frontend/src/pages/shared/Profile.js` — add avatar upload UI
- `frontend/src/components/common/Navbar.js` — show avatar in app bar

#### 11. No Confirmation Before Leaving Unsaved Forms

**Problem**: If a teacher fills out the Upload Material form or a student writes a long feedback message and accidentally navigates away, all input is lost with no warning.

**Fix**:
- Add a `usePrompt` or `beforeunload` listener on form pages when there are unsaved changes
- Show a confirmation dialog: "You have unsaved changes. Are you sure you want to leave?"

**Files to change**:
- `frontend/src/pages/teacher/UploadMaterial.js` — add unsaved changes guard
- `frontend/src/pages/student/SubmitFeedback.js` — add unsaved changes guard

### How to Verify
- Search for any material → title, course name, and type all display correctly in results
- Course filter dropdown in search shows actual courses from the database
- Preview button works on search result cards
- Upload form suggests existing course names
- Edit dialog shows the same material type options as the upload form
- Download gives a meaningful filename with proper extension
- Student dashboard shows AI Tutor as a quick action
- All existing features continue to work after these changes

---

## Phase 1: Course Enrollment System

**Assigned to: Jony** | **Branch: `feature/course-enrollment`** | 

### Why This Is First
Currently, all students see all materials. In Google Classroom, students must **join a course** to see its materials. This is the foundational change needed before announcements/assignments make sense.

### What to Build

#### Backend Changes

1. **New Model: `enrollmentModel.js`**
   - Fields: `student` (ref User), `course` (ref Course), `enrolledAt`, `status` (active/dropped)
   - Unique compound index on `(student, course)` — a student can't enroll twice

2. **New Controller: `enrollmentController.js`**
   - `enrollInCourse(req, res)` — Student enrolls in a course using a **course code** (use `courseNo` as the code)
   - `unenrollFromCourse(req, res)` — Student leaves a course
   - `getMyEnrolledCourses(req, res)` — Student gets their enrolled courses list
   - `getCourseStudents(req, res)` — Teacher/Admin gets list of students enrolled in their course
   - `removeStudent(req, res)` — Teacher/Admin removes a student from a course

3. **New Routes: `enrollmentRoutes.js`**
   - `POST /api/enrollments/enroll` — Student enrolls (body: `{ courseNo }`)
   - `POST /api/enrollments/unenroll/:courseId` — Student unenrolls
   - `GET /api/enrollments/my-courses` — Student's enrolled courses
   - `GET /api/enrollments/course/:courseId/students` — Students in a course
   - `DELETE /api/enrollments/course/:courseId/student/:studentId` — Remove student

4. **Update `materialController.js`**
   - For students: filter `getAllMaterials` to only show materials from **enrolled courses**
   - Teachers and Admins see all (no change for them)

5. **Update `searchController.js`**
   - For students: semantic search only searches through chunks from **enrolled courses** materials
   - This makes search results more relevant and prevents access to unenrolled content

6. **Update `statsController.js`**
   - Student stats: add enrolled courses count
   - Teacher stats: add enrolled students count per course
   - Admin stats: add total enrollments count

#### Frontend Changes

7. **New Page: `student/MyCourses.js`**
   - Shows enrolled courses as cards with material count, teacher name
   - "Join Course" button opens a dialog to enter course code
   - Each card has "Unenroll" option
   - Search/filter enrolled courses

8. **New Page: `teacher/CourseStudents.js`** (or add tab to existing CourseManagement)
   - For each course, show enrolled students list
   - "Remove Student" action
   - Show enrollment count on course cards

9. **Update Sidebar**
   - Add "My Courses" link for students
   - Update student dashboard to show enrolled courses widget

10. **Update `SearchMaterials.js`**
    - Course filter dropdown should only show enrolled courses for students

11. **Update Routes in `AppRouter.js`**
    - Add `/student/my-courses` route
    - Update teacher routes if new page was added

### How to Verify
- Register as a student → should see 0 materials until enrolling in a course
- Enroll in a course → materials from that course appear in Materials page and Search
- Unenroll → materials disappear from student's view
- Teacher can see who's enrolled in their courses
- Existing teacher/admin functionality should NOT break

---

## Phase 2: Announcements & Class Stream

**Assigned to: Jony** | **Branch: `feature/announcements`** |

### Why This Is Needed
In Google Classroom, the "Stream" is the main page — teachers post announcements, students see a live feed. Our project has no way for teachers to communicate with enrolled students except through material uploads.

### What to Build

#### Backend Changes

1. **New Model: `announcementModel.js`**
   - Fields: `course` (ref Course), `author` (ref User), `title`, `content` (text body), `isPinned` (boolean), `attachments` (array of `{ fileName, fileUrl }`), `comments` (embedded subdocument array with `user`, `text`, `createdAt`)
   - Timestamps enabled

2. **New Controller: `announcementController.js`**
   - `createAnnouncement(req, res)` — Teacher/Admin creates announcement for a course
   - `getAnnouncementsByCourse(req, res)` — Get all announcements for a course (paginated, newest first)
   - `getAnnouncement(req, res)` — Get single announcement with comments
   - `updateAnnouncement(req, res)` — Edit own announcement
   - `deleteAnnouncement(req, res)` — Delete own (teacher) or any (admin)
   - `pinAnnouncement(req, res)` — Pin/unpin an announcement (teacher/admin)
   - `addComment(req, res)` — Any enrolled user can comment
   - `deleteComment(req, res)` — Delete own comment or any (admin)

3. **New Routes: `announcementRoutes.js`**
   - `POST /api/announcements` — Create
   - `GET /api/announcements/course/:courseId` — List by course (paginated)
   - `GET /api/announcements/:id` — Single with comments
   - `PUT /api/announcements/:id` — Update
   - `DELETE /api/announcements/:id` — Delete
   - `PUT /api/announcements/:id/pin` — Toggle pin
   - `POST /api/announcements/:id/comments` — Add comment
   - `DELETE /api/announcements/:id/comments/:commentId` — Delete comment

4. **Enrollment check middleware/helper**
   - Helper function `isEnrolledOrTeacher(userId, courseId)` — used in announcement controller to verify access

#### Frontend Changes

5. **New Page: `shared/CourseStream.js`**
   - Route: `/:role/courses/:courseId/stream`
   - Shows course info at top (title, code, teacher, student count)
   - List of announcements (pinned ones at top) with comments
   - Teachers see a "Create Announcement" form at the top
   - Students see announcements and can comment
   - Each announcement shows: author name, date, content, comment count
   - Expand to see comments, add a comment

6. **Update Sidebar**
   - When viewing "My Courses", clicking a course navigates to its stream

7. **Update `AppRouter.js`**
   - Add stream routes for all roles

### How to Verify
- Teacher creates an announcement in a course → enrolled students see it
- Students can comment on announcements
- Non-enrolled students CANNOT see announcements
- Pinned announcements appear at the top
- Edit/delete works with proper ownership checks
- Pagination works for announcements

---

## Phase 3: Assignment & Grading System

**Assigned to: Niloy** | **Branch: `feature/assignments`** |

### Why This Is Needed
Assignments are THE core feature of Google Classroom. Teachers create homework with due dates, students submit their work, and teachers grade them. This is a must-have.

### What to Build

#### Backend Changes

1. **New Model: `assignmentModel.js`**
   - Fields:
     - `course` (ref Course)
     - `createdBy` (ref User — the teacher)
     - `title` (String, required)
     - `description` (String)
     - `dueDate` (Date)
     - `totalMarks` (Number, default: 100)
     - `attachments` (Array of `{ fileName, fileUrl }` — teacher can attach reference files)
     - `isPublished` (Boolean, default: true)
   - Timestamps enabled

2. **New Model: `submissionModel.js`**
   - Fields:
     - `assignment` (ref Assignment)
     - `student` (ref User)
     - `fileUrl` (String — submitted file on Cloudinary)
     - `fileName` (String)
     - `textContent` (String — optional text submission)
     - `submittedAt` (Date, default: now)
     - `isLate` (Boolean — computed from dueDate vs submittedAt)
     - `grade` (Number, null until graded)
     - `feedback` (String — teacher's comment on the submission)
     - `gradedBy` (ref User)
     - `gradedAt` (Date)
   - Unique compound index on `(assignment, student)` — one submission per student per assignment

3. **New Controller: `assignmentController.js`**
   - `createAssignment(req, res)` — Teacher creates assignment for a course
   - `getAssignmentsByCourse(req, res)` — List assignments for a course (paginated)
   - `getAssignment(req, res)` — Single assignment detail
   - `updateAssignment(req, res)` — Teacher edits
   - `deleteAssignment(req, res)` — Teacher/admin deletes (cascade delete submissions)
   - `submitAssignment(req, res)` — Student uploads submission file
   - `getMySubmission(req, res)` — Student checks their submission for an assignment
   - `getSubmissions(req, res)` — Teacher gets all submissions for an assignment
   - `gradeSubmission(req, res)` — Teacher grades a submission (grade + feedback)
   - `getMyGrades(req, res)` — Student gets all their grades across courses

4. **New Routes: `assignmentRoutes.js`**
   - `POST /api/assignments` — Create assignment
   - `GET /api/assignments/course/:courseId` — List by course
   - `GET /api/assignments/:id` — Single assignment
   - `PUT /api/assignments/:id` — Update
   - `DELETE /api/assignments/:id` — Delete
   - `POST /api/assignments/:id/submit` — Student submits (file upload)
   - `GET /api/assignments/:id/my-submission` — Student's own submission
   - `GET /api/assignments/:id/submissions` — All submissions (teacher)
   - `PUT /api/assignments/:id/submissions/:submissionId/grade` — Grade submission
   - `GET /api/assignments/my-grades` — Student's grades

5. **Update `server.js`** — Register new routes

6. **Update `statsController.js`**
   - Teacher stats: total assignments created, submissions pending grading
   - Student stats: assignments due, submitted, graded

#### Frontend Changes

7. **New Page: `shared/CourseAssignments.js`**
   - Route: `/:role/courses/:courseId/assignments`
   - **Teacher view**: List assignments + "Create Assignment" button
   - **Student view**: List assignments with status (Not submitted / Submitted / Graded)
   - Each assignment card shows: title, due date, marks, submission status
   - Color-coded: overdue (red), due soon (orange), submitted (green), graded (blue)

8. **New Page: `teacher/AssignmentDetail.js`**
   - Shows assignment details
   - Lists all student submissions with: student name, submitted date, late badge, grade
   - "Grade" button opens a dialog: enter marks + feedback text
   - Bulk actions: download all submissions

9. **New Page: `student/AssignmentSubmit.js`**
   - Shows assignment details (description, due date, marks, attachments)
   - File upload area for submission
   - Text area for optional text response
   - Shows "Late" warning if past due date
   - After submission: shows submitted file, grade (if graded), and teacher feedback

10. **New Page: `student/MyGrades.js`**
    - Table/list of all graded assignments across courses
    - Columns: Course, Assignment, Grade, Max Marks, Percentage, Teacher Feedback
    - Sort by date, course, grade

11. **Update Sidebar**
    - Student: Add "My Grades" link
    - Course stream: Add "Assignments" tab/link

12. **Update `AppRouter.js`** — Add all new routes

### How to Verify
- Teacher creates assignment with due date and attachment → enrolled students see it
- Student submits a file → submission saved, late flag computed correctly
- Teacher views submissions → can grade with marks and feedback
- Student checks grades → sees all graded work
- Delete assignment → cascade deletes all submissions
- Non-enrolled students can't see or submit

---

## Phase 4: In-App Notification System

**Assigned to: Jony** | **Branch: `feature/notifications`** |

### Why This Is Needed
Users currently have no way to know when something happens (new material uploaded, assignment posted, grade received, feedback responded). Google Classroom notifies users of all important events.

### What to Build

#### Backend Changes

1. **New Model: `notificationModel.js`**
   - Fields:
     - `recipient` (ref User)
     - `type` (enum: `new_material`, `new_announcement`, `new_assignment`, `submission_graded`, `assignment_due_soon`, `feedback_response`, `new_comment`, `enrollment_update`)
     - `title` (String)
     - `message` (String)
     - `link` (String — frontend path to navigate to)
     - `isRead` (Boolean, default: false)
     - `metadata` (Mixed — any extra data like courseId, materialId, etc.)
   - Timestamps enabled
   - Index on `(recipient, isRead, createdAt)`

2. **New Controller: `notificationController.js`**
   - `getMyNotifications(req, res)` — Paginated, newest first
   - `getUnreadCount(req, res)` — Returns `{ count: N }` for badge
   - `markAsRead(req, res)` — Mark single notification as read
   - `markAllAsRead(req, res)` — Mark all as read
   - `deleteNotification(req, res)` — Delete single
   - `clearAll(req, res)` — Delete all for user

3. **New Utility: `notificationHelper.js`**
   - `createNotification({ recipient, type, title, message, link, metadata })` — Reusable function
   - `notifyEnrolledStudents(courseId, notificationData)` — Send notification to all students enrolled in a course
   - `notifyCourseTeacher(courseId, notificationData)` — Notify the teacher of a course

4. **Integrate notification triggers into existing controllers**:
   - `materialController.js` → `uploadMaterial`: notify enrolled students "New material uploaded in [Course]"
   - `announcementController.js` → `createAnnouncement`: notify enrolled students
   - `assignmentController.js` → `createAssignment`: notify enrolled students
   - `assignmentController.js` → `gradeSubmission`: notify the student
   - `feedbackController.js` → `respondToFeedback`: notify the student (in-app, in addition to existing email)
   - `announcementController.js` → `addComment`: notify the announcement author

5. **New Routes: `notificationRoutes.js`**
   - `GET /api/notifications` — My notifications (paginated)
   - `GET /api/notifications/unread-count` — Badge count
   - `PUT /api/notifications/:id/read` — Mark as read
   - `PUT /api/notifications/read-all` — Mark all as read
   - `DELETE /api/notifications/:id` — Delete one
   - `DELETE /api/notifications` — Clear all

6. **Update `server.js`** — Register notification routes

#### Frontend Changes

7. **Update `Navbar.js`**
   - Add notification bell icon with unread count badge
   - Click opens a dropdown/popover showing recent notifications
   - Each notification: icon (by type), title, message, time ago, read/unread state
   - "Mark all read" button at top
   - "See all" link at bottom

8. **New Page: `shared/Notifications.js`**
   - Full notifications page with all notifications (paginated)
   - Filter by type, read/unread
   - Click a notification → navigate to the linked page + mark as read
   - "Clear All" button

9. **Update `AppRouter.js`** — Add `/[role]/notifications` route

10. **Poll for unread count** — On Navbar mount, poll `/api/notifications/unread-count` every 30 seconds to keep badge updated (simple polling, no WebSocket needed)

### How to Verify
- Teacher uploads material → enrolled students get notification
- Teacher creates announcement → students notified
- Teacher creates assignment → students notified
- Teacher grades submission → student gets notification
- Click notification → redirects to correct page
- Mark as read, mark all as read, delete — all work
- Navbar badge shows correct unread count

---

## Phase 5: AI Quiz Generation from Materials

**Assigned to: Niloy** | **Branch: `feature/ai-quiz`** |

### Why This Is a Selling Point
Google Classroom has NO built-in AI quiz generation. Our system can **automatically generate quizzes from uploaded course materials** using the RAG pipeline + Ollama. Teachers can generate quizzes in one click, and students can take self-assessment quizzes to test their understanding.

### What to Build

#### Backend Changes

1. **New Model: `quizModel.js`**
   - Fields:
     - `course` (ref Course)
     - `createdBy` (ref User)
     - `title` (String)
     - `description` (String)
     - `questions` (Array of embedded subdocuments):
       - `questionText` (String)
       - `options` (Array of 4 strings — for MCQ)
       - `correctAnswer` (Number — index 0-3)
       - `explanation` (String — why the answer is correct)
       - `difficulty` (enum: `easy`, `medium`, `hard`)
       - `sourceChunk` (String — which material chunk generated this question)
     - `isPublished` (Boolean, default: false)
     - `timeLimit` (Number — minutes, optional)
     - `totalQuestions` (Number)
   - Timestamps enabled

2. **New Model: `quizAttemptModel.js`**
   - Fields:
     - `quiz` (ref Quiz)
     - `student` (ref User)
     - `answers` (Array of `{ questionIndex, selectedAnswer }`)
     - `score` (Number — auto-calculated)
     - `totalMarks` (Number)
     - `percentage` (Number)
     - `startedAt` (Date)
     - `completedAt` (Date)
     - `timeTaken` (Number — seconds)
   - Unique compound index on `(quiz, student)` → one attempt per student (or allow retakes based on quiz settings)

3. **New Service: `quizGeneratorService.js`**
   - Uses existing `MaterialChunk` data + Ollama to generate MCQ questions
   - Flow:
     1. Fetch chunks for a given course (or specific material)
     2. For each selected chunk, construct a prompt asking Ollama to generate MCQ questions
     3. Prompt template: "Given this text: [chunk]. Generate [N] multiple choice questions with 4 options, correct answer, and explanation. Output as JSON."
     4. Parse Ollama's JSON output
     5. Validate and structure the questions
   - Function: `generateQuiz(courseNo, numQuestions, difficulty)` → returns array of question objects

4. **New Controller: `quizController.js`**
   - `generateQuiz(req, res)` — Teacher triggers AI quiz generation for a course
   - `getQuizzesByCourse(req, res)` — List quizzes for a course
   - `getQuiz(req, res)` — Get single quiz (teacher sees answers; student sees only questions)
   - `publishQuiz(req, res)` — Teacher publishes quiz
   - `deleteQuiz(req, res)` — Delete quiz + attempts
   - `submitAttempt(req, res)` — Student submits answers, auto-grade
   - `getMyAttempts(req, res)` — Student's quiz history
   - `getQuizResults(req, res)` — Teacher sees all attempts for a quiz

5. **New Routes: `quizRoutes.js`**
   - `POST /api/quizzes/generate` — AI generate quiz (teacher)
   - `GET /api/quizzes/course/:courseId` — List quizzes
   - `GET /api/quizzes/:id` — Single quiz
   - `PUT /api/quizzes/:id/publish` — Publish
   - `DELETE /api/quizzes/:id` — Delete
   - `POST /api/quizzes/:id/attempt` — Submit attempt (student)
   - `GET /api/quizzes/my-attempts` — Student's attempts
   - `GET /api/quizzes/:id/results` — Teacher's view of results

6. **Update `server.js`** and `statsController.js`

#### Frontend Changes

7. **New Page: `teacher/QuizGenerator.js`**
   - Select a course → choose number of questions (5/10/15/20) and difficulty
   - "Generate Quiz" button → loading state → shows generated questions preview
   - Teacher can review/edit questions before publishing
   - Edit individual questions, options, correct answer
   - "Publish" button makes it available to students

8. **New Page: `student/TakeQuiz.js`**
   - Shows quiz title, description, time limit, number of questions
   - "Start Quiz" button → shows questions one by one (or all at once)
   - Radio buttons for MCQ options
   - Timer display (if time limit set)
   - "Submit" button → shows results immediately
   - Results page: score, percentage, correct/wrong per question with explanations

9. **New Page: `shared/QuizList.js`**
   - Shows quizzes for a course with status (Not attempted / Completed with score)

10. **Update Sidebar** — Add quiz links for student and teacher

11. **Update `AppRouter.js`** — Add quiz routes

### How to Verify
- Teacher selects a course with materials → AI generates relevant quiz questions
- Generated questions are actually from the material content (not hallucinated)
- Teacher can edit questions before publishing
- Student takes quiz → correct auto-grading
- Results show explanations
- Teacher can see class results

---

## Phase 6: AI Summarization, Bookmarks & Study Analytics

**Assigned to: Jony** | **Branch: `feature/ai-summary-bookmarks`** |

### Why These Are Selling Points
1. **AI Summarization**: Students can get a quick summary of any material without reading the entire document. No such feature in Google Classroom.
2. **Bookmarks**: Students can save/bookmark materials they find useful for quick access later.
3. **Study Analytics**: A visual dashboard showing what courses have the most materials, search trends, popular topics — helps teachers understand what students need.

### What to Build

#### Backend Changes — AI Summarization

1. **New Service: `summaryService.js`**
   - Uses existing `MaterialChunk` data + Ollama to generate summaries
   - Function: `summarizeMaterial(materialId)` →
     1. Fetch all chunks for the material
     2. Concatenate top chunks (within token limit)
     3. Prompt Ollama: "Summarize the following course material in 5-8 bullet points. Be concise and focus on key concepts: [chunks]"
     4. Return summary text
   - Function: `summarizeCourse(courseNo)` → Summarize all materials in a course

2. **Add endpoints in `materialController.js`**
   - `GET /api/materials/:id/summary` — Get AI summary for a material
   - Cache summaries: add `summary` field to `materialModel.js` (cache generated summaries so Ollama isn't called every time)

#### Backend Changes — Bookmarks

3. **New Model: `bookmarkModel.js`**
   - Fields: `user` (ref User), `material` (ref Material), `note` (String, optional — user's personal note)
   - Unique compound index on `(user, material)`
   - Timestamps enabled

4. **New Controller: `bookmarkController.js`**
   - `toggleBookmark(req, res)` — Add or remove bookmark
   - `getMyBookmarks(req, res)` — Paginated list of bookmarked materials
   - `isBookmarked(req, res)` — Check if user bookmarked a specific material
   - `updateNote(req, res)` — Update personal note on a bookmark

5. **New Routes: `bookmarkRoutes.js`**
   - `POST /api/bookmarks/:materialId` — Toggle bookmark
   - `GET /api/bookmarks` — My bookmarks
   - `GET /api/bookmarks/:materialId/status` — Check bookmark status
   - `PUT /api/bookmarks/:materialId/note` — Update note

#### Backend Changes — Study Analytics

6. **New Controller: `analyticsController.js`**
   - `getSearchAnalytics(req, res)` — For admin/teacher:
     - Most searched queries (top 20)
     - Search volume by day (last 30 days)
     - Most searched courses
   - `getMaterialAnalytics(req, res)` — For admin/teacher:
     - Most bookmarked materials
     - Materials by course (bar chart data)
     - Upload trends over time
   - `getStudentStudyAnalytics(req, res)` — For students:
     - Their search frequency over time
     - Courses they search most
     - Quiz performance over time
     - AI Tutor usage stats

7. **New Routes: `analyticsRoutes.js`**
   - `GET /api/analytics/search` — Search analytics (admin/teacher)
   - `GET /api/analytics/materials` — Material analytics (admin/teacher)
   - `GET /api/analytics/my-study` — Student's study analytics

#### Frontend Changes

8. **Update `MaterialCard.js`**
   - Add bookmark icon (heart/star) on each material card
   - Click to toggle bookmark with animation
   - Show "Summarize with AI" button on material detail

9. **New Page: `student/Bookmarks.js`**
   - Grid/list of bookmarked materials with personal notes
   - Remove bookmark, edit note
   - Search within bookmarks

10. **New Component: `shared/MaterialSummary.js`**
    - Dialog/panel that shows AI-generated summary
    - "Generate Summary" button with loading state
    - Summary displays as bullet points
    - "Copy Summary" button

11. **New Page: `shared/Analytics.js`**
    - For admin/teacher: Charts showing search trends, popular materials, upload trends
    - For students: Personal study analytics (search frequency, quiz scores, study streak)
    - Use simple chart library (chart from MUI or a lightweight library)

12. **Update Sidebar** — Add "Bookmarks" for students, "Analytics" for admin/teacher

13. **Update `AppRouter.js`** — Add all new routes

### How to Verify
- Click bookmark on material → saves, icon changes state
- Bookmarks page shows all bookmarked materials
- "Summarize" button → AI generates relevant summary from material content
- Summary is cached → second request is instant
- Analytics page shows meaningful charts with real data
- All existing features still work

---

## Execution Order & Dependencies

```
Phase 0 (Improvements) ──→ Phase 1 (Enrollment) ─────┐
                                                       ├──→ Phase 2 (Announcements) ──→ Phase 4 (Notifications)
                           Phase 3 (Assignments) ────┘
                           
Phase 5 (AI Quiz) ──── can start after Phase 1 is merged
Phase 6 (AI Summary) ── can start after Phase 1 is merged
```

**Critical path**: Phase 0 should be done first to fix existing bugs. Then Phase 1 must be done because Phase 2, 3, 4, 5, 6 all depend on the enrollment system.

### Parallel Work Strategy
- **Jony** starts Phase 0 immediately (bug fixes + improvements, ~1 day)
- **Niloy** can start Phase 3 backend models/controllers while Jony does Phase 0 + Phase 1
- After Phase 0 merges: Jony starts Phase 1 immediately
- After Phase 1 merges: Jony does Phase 2, Niloy integrates Phase 3 with enrollment
- Jony does Phase 4 after Phase 2
- Niloy does Phase 5, Jony does Phase 6 (can run in parallel)

---

## Git Workflow

1. **Always branch from `main`** (after pulling latest)
2. **Branch naming**: `feature/[feature-name]`
3. **Before starting a phase**:
   ```bash
   git checkout main
   git pull origin main
   git checkout -b feature/[branch-name]
   ```
4. **After completing a phase**:
   ```bash
   git add .
   git commit -m "feat: [phase description]"
   git push origin feature/[branch-name]
   ```
5. **Create a Pull Request** on GitHub → merge into `main`
6. **Next phase starts from updated `main`**

---

## Prompt Templates

When you start a phase, copy the phase description above and paste it as a prompt to GitHub Copilot. Add this prefix:

> **"You are a professional developer. Implement the following phase for the Student-Aid-Semantic-Search project. Read the current codebase carefully before making changes. Make sure no existing features break. After implementing, verify there are no errors."**

Then paste the phase section.

---

## Risk Mitigation

| Risk | Mitigation |
|---|---|
| Ollama timeout on quiz generation | Use small chunks, limit to 5 questions per API call, retry logic |
| Enrollment system breaking existing material access | Keep backward-compatible: if no enrollments exist, show all materials |
| Phase merge conflicts | Always pull latest main before starting. Keep changes modular. |
| AI generating bad quiz questions | Teacher reviews/edits before publishing. Validation on JSON parsing. |
| Frontend getting too complex | Reuse existing components (PaginationControl, MaterialCard, EmptyState) |
| Timeline too tight | Phase 6 is lowest priority — can be partially done if time is short |

---

## Files That Will Be Created (New)

### Backend
- `models/enrollmentModel.js`
- `models/announcementModel.js`
- `models/assignmentModel.js`
- `models/submissionModel.js`
- `models/quizModel.js`
- `models/quizAttemptModel.js`
- `models/bookmarkModel.js`
- `models/notificationModel.js`
- `controllers/enrollmentController.js`
- `controllers/announcementController.js`
- `controllers/assignmentController.js`
- `controllers/quizController.js`
- `controllers/bookmarkController.js`
- `controllers/notificationController.js`
- `controllers/analyticsController.js`
- `routes/enrollmentRoutes.js`
- `routes/announcementRoutes.js`
- `routes/assignmentRoutes.js`
- `routes/quizRoutes.js`
- `routes/bookmarkRoutes.js`
- `routes/notificationRoutes.js`
- `routes/analyticsRoutes.js`
- `services/quizGeneratorService.js`
- `services/summaryService.js`
- `utils/notificationHelper.js`

### Frontend
- `pages/student/MyCourses.js`
- `pages/student/Bookmarks.js`
- `pages/student/TakeQuiz.js`
- `pages/student/MyGrades.js`
- `pages/teacher/AssignmentDetail.js`
- `pages/teacher/QuizGenerator.js`
- `pages/shared/CourseStream.js`
- `pages/shared/CourseAssignments.js`
- `pages/shared/Notifications.js`
- `pages/shared/QuizList.js`
- `pages/shared/Analytics.js`
- `components/common/MaterialSummary.js`
- `services/enrollmentService.js`
- `services/announcementService.js`
- `services/assignmentService.js`
- `services/quizService.js`
- `services/bookmarkService.js`
- `services/notificationService.js`
- `services/analyticsService.js`

### Files That Will Be Modified
- `backend/server.js` (register new routes)
- `backend/models/materialModel.js` (add `originalFileName` field — Phase 0, add `summary` cache field — Phase 6)
- `backend/models/userModel.js` (add `avatar` field — Phase 0)
- `backend/controllers/searchController.js` (fix field names in search results — Phase 0, enrollment filter — Phase 1)
- `backend/controllers/materialController.js` (save original filename — Phase 0, enrollment filter — Phase 1, summary endpoint — Phase 6)
- `backend/controllers/userController.js` (avatar upload — Phase 0)
- `backend/controllers/statsController.js` (new stats)
- `backend/controllers/feedbackController.js` (notification trigger)
- `backend/controllers/announcementController.js` (notification trigger — Phase 4)
- `backend/controllers/assignmentController.js` (notification trigger — Phase 4)
- `frontend/src/components/common/MaterialCard.js` (fix field access for search results — Phase 0, add preview button — Phase 0, bookmark icon — Phase 6)
- `frontend/src/pages/student/SearchMaterials.js` (replace hardcoded filters with API data — Phase 0, add FilePreviewDialog — Phase 0, enrollment course filter — Phase 1)
- `frontend/src/pages/student/Dashboard.js` (add AI Tutor quick action — Phase 0)
- `frontend/src/pages/teacher/UploadMaterial.js` (course autocomplete — Phase 0, unsaved changes guard — Phase 0)
- `frontend/src/pages/student/SubmitFeedback.js` (unsaved changes guard — Phase 0)
- `frontend/src/pages/shared/Materials.js` (fix edit dialog type options — Phase 0, pagination — Phase 0)
- `frontend/src/pages/shared/Profile.js` (avatar upload — Phase 0)
- `frontend/src/components/common/Navbar.js` (show avatar — Phase 0, notification bell — Phase 4)
- `frontend/src/router/AppRouter.js` (new routes)
- `frontend/src/components/common/Sidebar.js` (new links)
- `frontend/src/services/index.js` (export new services)
- `frontend/src/pages/index.js` (export new pages)
- `frontend/src/pages/student/index.js` (export new pages)
- `frontend/src/pages/teacher/index.js` (export new pages)
- `frontend/src/pages/shared/index.js` (export new pages)

---

## Summary Table

| Phase | Feature | Assigned | Branch | New Backend Files | New Frontend Files | Priority |
|---|---|---|---|---|---|---|
| 0 | Existing Feature Improvements | Jony | `fix/existing-improvements` | 0 (modifications only) | 0 (modifications only) | 🔴 Critical |
| 1 | Course Enrollment | Jony | `feature/course-enrollment` | 3 | 2 | 🔴 Critical |
| 2 | Announcements & Stream | Jony | `feature/announcements` | 3 | 1 | 🔴 Critical |
| 3 | Assignments & Grading | Niloy | `feature/assignments` | 4 | 4 | 🔴 Critical |
| 4 | In-App Notifications | Jony | `feature/notifications` | 4 | 2 | 🟡 Important |
| 5 | AI Quiz Generation | Niloy | `feature/ai-quiz` | 4 | 3 | 🌟 Selling Point |
| 6 | AI Summary + Bookmarks + Analytics | Jony | `feature/ai-summary-bookmarks` | 5 | 5 | 🌟 Selling Point |

**Jony**: Phases 0, 1, 2, 4, 6 
**Niloy**: Phases 3, 5 
