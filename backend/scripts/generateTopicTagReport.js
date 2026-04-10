import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import Course from "../models/courseModel.js";
import { buildTopicCoverageReport } from "../utils/topicTagValidation.js";

const connect = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }
  await mongoose.connect(process.env.MONGO_URI);
};

const toCsv = (rows = [], headers = []) => {
  const lines = [headers.join(",")];
  for (const row of rows) {
    const values = headers.map((h) => {
      const value = row[h] == null ? "" : String(row[h]);
      return `"${value.replace(/"/g, '""')}"`;
    });
    lines.push(values.join(","));
  }
  return lines.join("\n");
};

const run = async () => {
  await connect();

  const targetCourseId = process.env.TOPIC_REPORT_COURSE_ID;
  const course = targetCourseId
    ? await Course.findById(targetCourseId).lean()
    : await Course.findOne().lean();

  if (!course?._id) {
    throw new Error("No course found. Set TOPIC_REPORT_COURSE_ID or create a course first.");
  }

  const report = await buildTopicCoverageReport(course._id);

  const outDir = path.join(process.cwd(), "reports");
  await fs.mkdir(outDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(outDir, `topic-tag-report-${timestamp}.json`);
  const questionCsvPath = path.join(outDir, `untagged-questions-${timestamp}.csv`);
  const materialCsvPath = path.join(outDir, `untagged-materials-${timestamp}.csv`);
  const ambiguousQuestionCsvPath = path.join(outDir, `ambiguous-questions-${timestamp}.csv`);
  const ambiguousMaterialCsvPath = path.join(outDir, `ambiguous-materials-${timestamp}.csv`);

  await fs.writeFile(jsonPath, JSON.stringify(report, null, 2), "utf8");
  await fs.writeFile(
    questionCsvPath,
    toCsv(report.untaggedQuestionRefs, ["quizId", "quizTitle", "questionIndex", "questionText"]),
    "utf8"
  );
  await fs.writeFile(
    materialCsvPath,
    toCsv(report.untaggedMaterials, ["materialId", "title"]),
    "utf8"
  );
  await fs.writeFile(
    ambiguousQuestionCsvPath,
    toCsv(report.ambiguousQuestionRefs || [], [
      "quizId",
      "quizTitle",
      "questionIndex",
      "questionText",
      "topTopicA",
      "topTopicB",
      "confidenceA",
      "confidenceB",
    ]),
    "utf8"
  );
  await fs.writeFile(
    ambiguousMaterialCsvPath,
    toCsv(report.ambiguousMaterialRefs || [], [
      "materialId",
      "title",
      "topTopicA",
      "topTopicB",
      "confidenceA",
      "confidenceB",
    ]),
    "utf8"
  );

  console.log("Topic tag report generated", {
    courseId: String(course._id),
    jsonPath,
    questionCsvPath,
    materialCsvPath,
    ambiguousQuestionCsvPath,
    ambiguousMaterialCsvPath,
    summary: report.summary,
  });

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Report generation failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
