/**
 * Event Controller
 * Manages academic events: Central Viva, Presentation, Thesis Defense, Project Show.
 *
 * Flow:
 *  - Teacher creates event → assigns a teacher per course → other teachers notified
 *  - Students register with the event registration code
 *  - Assigned teacher marks students for their course only
 *  - Event creator generates/downloads a result sheet (CSV) with average marks
 */
import Event from "../models/eventModel.js";
import EventRegistration from "../models/eventRegistrationModel.js";
import EventMark from "../models/eventMarkModel.js";
import User from "../models/userModel.js";
import Course from "../models/courseModel.js";
import { createNotification } from "../utils/notificationHelper.js";
import { sendEmail } from "../utils/sendEmail.js";

// ─────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────
const EVENT_TYPE_LABELS = {
  central_viva: "Central Viva",
  presentation: "Presentation",
  thesis_defense: "Thesis Defense",
  project_show: "Project Show",
};

const getComputedEventStatus = (eventDate, existingStatus) => {
  if (!eventDate) return existingStatus || "upcoming";
  if (existingStatus === "completed") return "completed";

  const now = Date.now();
  const startTime = new Date(eventDate).getTime();
  if (Number.isNaN(startTime)) return existingStatus || "upcoming";

  return now < startTime ? "upcoming" : "completed";
};

const withComputedStatus = (eventDoc) => {
  if (!eventDoc) return eventDoc;
  const eventObj = typeof eventDoc.toObject === "function" ? eventDoc.toObject() : { ...eventDoc };
  eventObj.status = getComputedEventStatus(eventObj.eventDate, eventObj.status);
  return eventObj;
};

// ─────────────────────────────────────────────
// Teacher: Create Event
// ─────────────────────────────────────────────

/**
 * @route POST /api/events
 * @access Teacher
 */
export const createEvent = async (req, res) => {
  try {
    const { title, type, courses, eventDate, venue, description } = req.body;

    if (!title || !type || !eventDate || !Array.isArray(courses) || courses.length === 0) {
      return res.status(400).json({ message: "title, type, eventDate, and at least one course are required" });
    }

    // Validate each course entry has course + teacher
    for (const entry of courses) {
      if (!entry.course || !entry.teacher) {
        return res.status(400).json({ message: "Each course entry must include a course id and a teacher id" });
      }
    }

    const event = await Event.create({
      title,
      type,
      courses,
      eventDate,
      venue: venue || "",
      description: description || "",
      createdBy: req.user._id,
    });

    // Populate for response
    const populated = await Event.findById(event._id)
      .populate("createdBy", "name email")
      .populate("courses.course", "courseNo courseTitle")
      .populate("courses.teacher", "name email");

    // Notify all assigned teachers (excluding the creator)
    const uniqueTeacherIds = [
      ...new Set(
        courses
          .map((c) => c.teacher.toString())
          .filter((id) => id !== req.user._id.toString())
      ),
    ];

    if (uniqueTeacherIds.length > 0) {
      const teachers = await User.find({ _id: { $in: uniqueTeacherIds } }, "name email").lean();
      const typeLabel = EVENT_TYPE_LABELS[type] || type;
      const eventDate_ = new Date(eventDate).toLocaleDateString();

      for (const teacher of teachers) {
        createNotification({
          recipient: teacher._id,
          type: "event_invite",
          title: `You have been assigned to an event`,
          message: `${req.user.name} has assigned you as an examiner for "${title}" (${typeLabel}) on ${eventDate_}`,
          link: `/teacher/events/${event._id}`,
          metadata: { eventId: event._id },
        }).catch(() => {});

        sendEmail(
          teacher.email,
          `Event Assignment: ${title}`,
          `${req.user.name} has assigned you as an examiner for "${title}" (${typeLabel}) on ${eventDate_}. Please present at venue ${venue || "TBA"} on time. Log in to view details and mark students.`,
          { name: teacher.name, link: `/teacher/events/${event._id}` }
        ).catch(() => {});
      }
    }

    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Teacher: Get events where they are creator or assigned teacher
// ─────────────────────────────────────────────

/**
 * @route GET /api/events
 * @access Teacher
 */
export const getMyEvents = async (req, res) => {
  try {
    const events = await Event.find({
      $or: [{ createdBy: req.user._id }, { "courses.teacher": req.user._id }],
    })
      .populate("createdBy", "name email")
      .populate("courses.course", "courseNo courseTitle")
      .populate("courses.teacher", "name email")
      .sort("-eventDate");

    const normalized = events.map((event) => withComputedStatus(event));
    res.status(200).json(normalized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Teacher: Get single event
// ─────────────────────────────────────────────

/**
 * @route GET /api/events/:id
 * @access Teacher (creator or assigned)
 */
export const getEventById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("createdBy", "name email")
      .populate("courses.course", "courseNo courseTitle")
      .populate("courses.teacher", "name email");

    if (!event) return res.status(404).json({ message: "Event not found" });

    const isCreator = event.createdBy._id.toString() === req.user._id.toString();
    const isAssigned = event.courses.some((c) => c.teacher._id.toString() === req.user._id.toString());

    if (!isCreator && !isAssigned) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Fetch registered students
    const registrations = await EventRegistration.find({ event: event._id })
      .populate("student", "name email studentId")
      .sort("createdAt");

    res.status(200).json({ event: withComputedStatus(event), registrations });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Teacher: Update event (creator only)
// ─────────────────────────────────────────────

/**
 * @route PUT /api/events/:id
 * @access Teacher (creator only)
 */
export const updateEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the event creator can update it" });
    }

    const { title, type, courses, eventDate, venue, description, status } = req.body;
    if (title) event.title = title;
    if (type) event.type = type;
    if (courses) event.courses = courses;
    if (eventDate) event.eventDate = eventDate;
    if (venue !== undefined) event.venue = venue;
    if (description !== undefined) event.description = description;
    if (status) event.status = status;

    await event.save();
    const populated = await Event.findById(event._id)
      .populate("createdBy", "name email")
      .populate("courses.course", "courseNo courseTitle")
      .populate("courses.teacher", "name email");

    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Teacher: Delete event (creator only)
// ─────────────────────────────────────────────

/**
 * @route DELETE /api/events/:id
 * @access Teacher (creator only)
 */
export const deleteEvent = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the event creator can delete it" });
    }

    await Event.findByIdAndDelete(req.params.id);
    await EventRegistration.deleteMany({ event: req.params.id });
    await EventMark.deleteMany({ event: req.params.id });

    res.status(200).json({ message: "Event deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Student: Register for event using code
// ─────────────────────────────────────────────

/**
 * @route POST /api/events/register
 * @access Student
 */
export const registerForEvent = async (req, res) => {
  try {
    const { registrationCode } = req.body;
    if (!registrationCode) return res.status(400).json({ message: "registrationCode is required" });

    const event = await Event.findOne({ registrationCode: registrationCode.trim().toUpperCase() })
      .populate("courses.course", "courseNo courseTitle")
      .populate("courses.teacher", "name");

    if (!event) return res.status(404).json({ message: "Invalid registration code" });

    const computedStatus = getComputedEventStatus(event.eventDate, event.status);
    if (computedStatus === "completed") {
      return res.status(400).json({ message: "This event is already completed. Registration is closed." });
    }

    // Check if already registered
    const existing = await EventRegistration.findOne({ event: event._id, student: req.user._id });
    if (existing) return res.status(400).json({ message: "You are already registered for this event" });

    await EventRegistration.create({ event: event._id, student: req.user._id });

    res.status(201).json({ message: "Registered successfully", event: withComputedStatus(event) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Student: Get registered events
// ─────────────────────────────────────────────

/**
 * @route GET /api/events/my-registrations
 * @access Student
 */
export const getMyRegistrations = async (req, res) => {
  try {
    const regs = await EventRegistration.find({ student: req.user._id })
      .populate({
        path: "event",
        populate: [
          { path: "createdBy", select: "name" },
          { path: "courses.course", select: "courseNo courseTitle" },
          { path: "courses.teacher", select: "name" },
        ],
      })
      .sort("-createdAt");

    const normalized = regs.map((reg) => {
      const regObj = reg.toObject();
      regObj.event = withComputedStatus(regObj.event);
      return regObj;
    });

    res.status(200).json(normalized);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Teacher: Save marks for their assigned course
// ─────────────────────────────────────────────

/**
 * @route POST /api/events/:id/marks
 * @access Teacher (assigned to at least one course in this event)
 * Body: { marks: [{ studentId, courseId, mark }] }
 */
export const saveMarks = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Cannot save marks before the event has started
    if (new Date(event.eventDate) > new Date()) {
      return res.status(400).json({ message: "Cannot save marks before the event has started" });
    }

    // Determine which courses this teacher is assigned to
    const assignedCourseIds = event.courses
      .filter((c) => c.teacher.toString() === req.user._id.toString())
      .map((c) => c.course.toString());

    if (assignedCourseIds.length === 0) {
      return res.status(403).json({ message: "You are not assigned to any course in this event" });
    }

    const { marks } = req.body; // [{ studentId, courseId, mark }]
    if (!Array.isArray(marks) || marks.length === 0) {
      return res.status(400).json({ message: "marks array is required" });
    }

    // Validate each mark entry
    for (const m of marks) {
      if (!m.studentId || !m.courseId || m.mark === undefined) {
        return res.status(400).json({ message: "Each mark must have studentId, courseId, and mark" });
      }
      if (!assignedCourseIds.includes(m.courseId.toString())) {
        return res.status(403).json({ message: `You are not assigned to course ${m.courseId}` });
      }
      if (m.mark < 0 || m.mark > 100) {
        return res.status(400).json({ message: "Mark must be between 0 and 100" });
      }
    }

    // Upsert marks
    const ops = marks.map((m) => ({
      updateOne: {
        filter: { event: event._id, student: m.studentId, course: m.courseId },
        update: { $set: { teacher: req.user._id, mark: m.mark } },
        upsert: true,
      },
    }));
    await EventMark.bulkWrite(ops);

    res.status(200).json({ message: "Marks saved successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Teacher: Get existing marks for their course
// ─────────────────────────────────────────────

/**
 * @route GET /api/events/:id/marks
 * @access Teacher (assigned to the event)
 */
export const getMarks = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Event not found" });

    const isCreator = event.createdBy.toString() === req.user._id.toString();
    const assignedCourseIds = event.courses
      .filter((c) => c.teacher.toString() === req.user._id.toString())
      .map((c) => c.course.toString());

    if (!isCreator && assignedCourseIds.length === 0) {
      return res.status(403).json({ message: "Access denied" });
    }

    const filter = { event: event._id };
    // Non-creators only see their own course marks
    if (!isCreator && assignedCourseIds.length > 0) {
      filter.course = { $in: assignedCourseIds };
    }

    const marks = await EventMark.find(filter)
      .populate("student", "name email")
      .populate("course", "courseNo courseTitle");

    res.status(200).json(marks);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Teacher (creator): Download detailed result as CSV
// ─────────────────────────────────────────────

/**
 * @route GET /api/events/:id/detailed-result
 * @access Teacher (creator only)
 */
export const downloadDetailedResult = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id)
      .populate("courses.course", "courseNo courseTitle");

    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the event creator can download the result sheet" });
    }

    // Get all registered students
    const registrations = await EventRegistration.find({ event: event._id })
      .populate("student", "name email")
      .lean();

    if (registrations.length === 0) {
      return res.status(400).json({ message: "No registered students found" });
    }

    const studentIds = registrations.map((r) => r.student._id.toString());

    // Get all marks for this event
    const allMarks = await EventMark.find({ event: event._id }).populate("course", "courseNo").lean();

    // Build per-student mark map: { studentId: { courseId: mark } }
    const markMap = {};
    for (const m of allMarks) {
      const sid = m.student.toString();
      const cid = m.course._id.toString();
      if (!markMap[sid]) markMap[sid] = {};
      markMap[sid][cid] = m.mark;
    }

    const courseEntries = event.courses;
    const numCourses = courseEntries.length;

    // Build CSV
    const courseHeaders = courseEntries.map((c) => `"${c.course.courseNo}"`).join(",");
    const headerRow = `"Student Name","Email",${courseHeaders},"Average Mark"`;

    const rows = registrations.map((reg) => {
      const sid = reg.student._id.toString();
      const studentMarks = markMap[sid] || {};
      const markValues = courseEntries.map((c) => {
        const m = studentMarks[c.course._id.toString()];
        return m !== undefined ? m : "";
      });
      const defined = markValues.filter((m) => m !== "");
      const avg = defined.length > 0 ? (defined.reduce((a, b) => a + b, 0) / defined.length).toFixed(2) : "";
      const markCols = markValues.map((m) => (m === "" ? `""` : `"${m}"`)).join(",");
      return `"${reg.student.name}","${reg.student.email}",${markCols},"${avg}"`;
    });

    const csvContent = [headerRow, ...rows].join("\n");

    const safeTitle = event.title.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/ /g, "_");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}_detailed_result.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ─────────────────────────────────────────────
// Teacher (creator): Download professional PDF result sheet
// ─────────────────────────────────────────────

/**
 * @route GET /api/events/:id/result-sheet-pdf
 * @access Teacher (creator only)
 */
export const downloadResultSheetPdf = async (req, res) => {
  try {
    const PDFDocument = (await import("pdfkit")).default;

    const event = await Event.findById(req.params.id)
      .populate("courses.course", "courseNo courseTitle")
      .populate("createdBy", "name");

    if (!event) return res.status(404).json({ message: "Event not found" });

    if (event.createdBy._id.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the event creator can download the result sheet" });
    }

    const registrations = await EventRegistration.find({ event: event._id })
      .populate("student", "name email idNumber")
      .lean();

    if (registrations.length === 0) {
      return res.status(400).json({ message: "No registered students found" });
    }

    const allMarks = await EventMark.find({ event: event._id }).populate("course", "courseNo").lean();

    const markMap = {};
    for (const m of allMarks) {
      const sid = m.student.toString();
      const cid = m.course._id.toString();
      if (!markMap[sid]) markMap[sid] = {};
      markMap[sid][cid] = m.mark;
    }

    const courseEntries = event.courses;
    const typeLabel = EVENT_TYPE_LABELS[event.type] || event.type;
    const eventDateStr = new Date(event.eventDate).toLocaleDateString("en-GB");

    // ── Build PDF ──
    const doc = new PDFDocument({ size: "A4", margin: 50 });
    const safeTitle = event.title.replace(/[^a-zA-Z0-9_\- ]/g, "").replace(/ /g, "_");

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeTitle}_result_sheet.pdf"`);
    doc.pipe(res);

    const PRIMARY = "#1565C0";
    const HEADER_BG = "#1565C0";
    const HEADER_TEXT = "#FFFFFF";
    const ROW_ALT = "#F5F5F5";
    const BORDER = "#E0E0E0";
    const pageWidth = doc.page.width - 100; // margins

    // ── Title Block ──
    doc.rect(50, 50, pageWidth, 60).fill(PRIMARY);
    doc.fillColor(HEADER_TEXT).fontSize(20).font("Helvetica-Bold")
      .text("RESULT SHEET", 50, 65, { width: pageWidth, align: "center" });
    doc.fontSize(10).font("Helvetica")
      .text(event.title, 50, 90, { width: pageWidth, align: "center" });

    // ── Event Info ──
    let y = 130;
    doc.fillColor("#333333").fontSize(10).font("Helvetica-Bold");

    const infoLines = [
      ["Event Type", typeLabel],
      ["Date", eventDateStr],
      ["Venue", event.venue || "N/A"],
      ["Organized By", event.createdBy.name],
      ["Total Students", String(registrations.length)],
      ["Courses", courseEntries.map((c) => c.course.courseNo).join(", ")],
    ];

    for (const [label, value] of infoLines) {
      doc.font("Helvetica-Bold").text(`${label}: `, 60, y, { continued: true });
      doc.font("Helvetica").text(value);
      y += 16;
    }

    y += 15;

    // ── Divider ──
    doc.moveTo(50, y).lineTo(50 + pageWidth, y).strokeColor(PRIMARY).lineWidth(2).stroke();
    y += 15;

    // ── Table ──
    const colStudentId = 80;
    const colName = 140;
    const colAvg = 80;
    const tableX = 50;

    // Header row
    doc.rect(tableX, y, pageWidth, 22).fill(HEADER_BG);
    doc.fillColor(HEADER_TEXT).fontSize(9).font("Helvetica-Bold");
    doc.text("Student ID", tableX + 5, y + 6, { width: colStudentId, align: "left" });
    doc.text("Student Name", tableX + colStudentId + 5, y + 6, { width: colName, align: "left" });
    doc.text("Average Mark", tableX + pageWidth - colAvg - 5, y + 6, { width: colAvg, align: "center" });
    y += 22;

    // Data rows
    doc.fontSize(9).font("Helvetica");
    registrations.forEach((reg, idx) => {
      // Page break check
      if (y > doc.page.height - 80) {
        doc.addPage();
        y = 50;
        // Re-draw header
        doc.rect(tableX, y, pageWidth, 22).fill(HEADER_BG);
        doc.fillColor(HEADER_TEXT).fontSize(9).font("Helvetica-Bold");
        doc.text("Student ID", tableX + 5, y + 6, { width: colStudentId, align: "left" });
        doc.text("Student Name", tableX + colStudentId + 5, y + 6, { width: colName, align: "left" });
        doc.text("Average Mark", tableX + pageWidth - colAvg - 5, y + 6, { width: colAvg, align: "center" });
        y += 22;
        doc.fontSize(9).font("Helvetica");
      }

      const rowColor = idx % 2 === 0 ? "#FFFFFF" : ROW_ALT;
      doc.rect(tableX, y, pageWidth, 20).fill(rowColor);

      const sid = reg.student._id.toString();
      const studentMarks = markMap[sid] || {};
      const markValues = courseEntries.map((c) => studentMarks[c.course._id.toString()]);
      const defined = markValues.filter((m) => m !== undefined);
      const avg = defined.length > 0 ? (defined.reduce((a, b) => a + b, 0) / defined.length).toFixed(2) : "N/A";

      doc.fillColor("#333333");
      doc.text(reg.student.idNumber || "—", tableX + 5, y + 5, { width: colStudentId, align: "left" });
      doc.text(reg.student.name || "—", tableX + colStudentId + 5, y + 5, { width: colName, align: "left" });
      doc.text(String(avg), tableX + pageWidth - colAvg - 5, y + 5, { width: colAvg, align: "center" });
      y += 20;
    });

    // Bottom border
    doc.moveTo(tableX, y).lineTo(tableX + pageWidth, y).strokeColor(BORDER).lineWidth(0.5).stroke();

    // ── Footer ──
    y += 25;
    doc.fillColor("#888888").fontSize(8).font("Helvetica")
      .text(`Generated on ${new Date().toLocaleDateString("en-GB")} • Student Aid`, 50, y, {
        width: pageWidth,
        align: "center",
      });

    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
