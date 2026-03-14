import Quiz from "../../models/quizModel.js";
import Course from "../../models/courseModel.js";
import { generateQuiz as generateQuizFromMaterials } from "../../services/quizGeneratorService.js";

export const quizGenerationProcessor = async (job) => {
  const { courseId, title, description, numQuestions, difficulty, timeLimit, materialId, createdBy } = job.data;

  const course = await Course.findById(courseId).lean();
  if (!course) throw new Error("Course not found");

  const questions = await generateQuizFromMaterials(
    course.courseNo,
    Number(numQuestions) || 5,
    difficulty || "medium",
    materialId || null,
    courseId
  );

  const quiz = await Quiz.create({
    course: courseId,
    createdBy,
    title: String(title).trim(),
    description: description ? String(description).trim() : "",
    questions,
    isPublished: false,
    timeLimit: timeLimit ? Number(timeLimit) : null,
    totalQuestions: questions.length,
  });

  return { quizId: quiz._id, totalQuestions: questions.length };
};
