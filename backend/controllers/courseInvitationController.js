/**
 * Course Invitation Controller
 * Teachers can invite other teachers to co-teach a course.
 */
import CourseInvitation from "../models/courseInvitationModel.js";
import Course from "../models/courseModel.js";
import User from "../models/userModel.js";
import { createNotification } from "../utils/notificationHelper.js";
import { sendEmail } from "../utils/sendEmail.js";

/**
 * Send a course invitation to another teacher
 * @route POST /api/course-invitations
 * @access Teacher (own course only)
 */
export const sendInvitation = async (req, res) => {
  try {
    const { courseId, toTeacherId, message } = req.body;

    if (!courseId || !toTeacherId) {
      return res.status(400).json({ message: "courseId and toTeacherId are required" });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ message: "Course not found" });

    // Only the course creator can send invitations
    if (course.createdBy.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "Only the course creator can invite co-teachers" });
    }

    // Cannot invite yourself
    if (toTeacherId === req.user._id.toString()) {
      return res.status(400).json({ message: "You cannot invite yourself" });
    }

    const toTeacher = await User.findById(toTeacherId);
    if (!toTeacher || toTeacher.role !== "teacher") {
      return res.status(404).json({ message: "Target user not found or is not a teacher" });
    }

    // Already a co-teacher?
    if (course.coTeachers.map((id) => id.toString()).includes(toTeacherId)) {
      return res.status(400).json({ message: "This teacher is already a co-teacher of this course" });
    }

    // Upsert: if a declined invitation exists, reset it to pending
    let invitation = await CourseInvitation.findOne({
      from: req.user._id,
      to: toTeacherId,
      course: courseId,
    });

    if (invitation) {
      if (invitation.status === "pending") {
        return res.status(400).json({ message: "An invitation is already pending for this teacher" });
      }
      invitation.status = "pending";
      invitation.message = message || "";
      await invitation.save();
    } else {
      invitation = await CourseInvitation.create({
        from: req.user._id,
        to: toTeacherId,
        course: courseId,
        message: message || "",
      });
    }

    // In-app notification
    await createNotification({
      recipient: toTeacherId,
      type: "course_invite",
      title: "Course Co-Teacher Invitation",
      message: `${req.user.name} has invited you to co-teach "${course.courseTitle}"`,
      link: "/teacher/invitations",
      metadata: { invitationId: invitation._id, courseId },
    });

    // Email notification
    sendEmail(
      toTeacher.email,
      "Course Co-Teacher Invitation",
      `${req.user.name} has invited you to co-teach "${course.courseTitle}". Log in to accept or decline.`,
      { name: toTeacher.name, link: "/teacher/invitations" }
    ).catch(() => {});

    res.status(201).json({ message: "Invitation sent", invitation });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "An invitation already exists for this teacher and course" });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get invitations received by the logged-in teacher
 * @route GET /api/course-invitations/received
 * @access Teacher
 */
export const getReceivedInvitations = async (req, res) => {
  try {
    const invitations = await CourseInvitation.find({ to: req.user._id })
      .populate("from", "name email")
      .populate("course", "courseNo courseTitle department semester")
      .sort("-createdAt");
    res.status(200).json(invitations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get invitations sent by the logged-in teacher
 * @route GET /api/course-invitations/sent
 * @access Teacher
 */
export const getSentInvitations = async (req, res) => {
  try {
    const invitations = await CourseInvitation.find({ from: req.user._id })
      .populate("to", "name email")
      .populate("course", "courseNo courseTitle department semester")
      .sort("-createdAt");
    res.status(200).json(invitations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Respond to an invitation (accept or decline)
 * @route PUT /api/course-invitations/:id/respond
 * @access Teacher (only the invited teacher)
 */
export const respondToInvitation = async (req, res) => {
  try {
    const { status } = req.body; // "accepted" or "declined"
    if (!["accepted", "declined"].includes(status)) {
      return res.status(400).json({ message: "status must be 'accepted' or 'declined'" });
    }

    const invitation = await CourseInvitation.findById(req.params.id).populate("course");
    if (!invitation) return res.status(404).json({ message: "Invitation not found" });

    if (invitation.to.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: "This invitation is not addressed to you" });
    }

    if (invitation.status !== "pending") {
      return res.status(400).json({ message: "This invitation has already been responded to" });
    }

    invitation.status = status;
    await invitation.save();

    if (status === "accepted") {
      // Add to coTeachers if not already present
      await Course.findByIdAndUpdate(invitation.course._id, {
        $addToSet: { coTeachers: req.user._id },
      });
    }

    // Notify the sender
    const course = invitation.course;
    const action = status === "accepted" ? "accepted" : "declined";
    await createNotification({
      recipient: invitation.from,
      type: "course_invite",
      title: `Invitation ${action}`,
      message: `${req.user.name} has ${action} your invitation to co-teach "${course.courseTitle}"`,
      link: `/teacher/courses`,
      metadata: { invitationId: invitation._id, courseId: course._id },
    });

    res.status(200).json({ message: `Invitation ${action}`, invitation });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * Get all teachers (for selecting invitation recipient)
 * @route GET /api/course-invitations/teachers
 * @access Teacher
 */
export const getAllTeachers = async (req, res) => {
  try {
    const teachers = await User.find({ role: "teacher", _id: { $ne: req.user._id } }, "name email").sort("name");
    res.status(200).json(teachers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
