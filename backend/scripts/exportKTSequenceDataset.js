import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import LearningEvent from "../models/learningEventModel.js";

const connect = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing");
  await mongoose.connect(process.env.MONGO_URI);
};

const csvEscape = (value) => {
  const text = value == null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const toCsv = (rows, headers) => {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  return lines.join("\n");
};

const normalizeDifficulty = (difficulty) => {
  const value = String(difficulty || "unknown").toLowerCase();
  if (["easy", "medium", "hard"].includes(value)) return value;
  return "unknown";
};

const run = async () => {
  await connect();

  const lookbackDays = Number(process.env.KT_EXPORT_LOOKBACK_DAYS || 365);
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - lookbackDays);

  const events = await LearningEvent.find({
    eventTimestamp: { $gte: from },
    eventType: { $in: ["question_attempt", "assignment_attempt"] },
    isCorrect: { $in: [true, false] },
  })
    .sort({ student: 1, eventTimestamp: 1 })
    .select(
      "student course topicId sourceType eventType isCorrect difficulty timeSpentSec hintUsed eventTimestamp"
    )
    .lean();

  const rows = events.map((event) => ({
    studentId: String(event.student),
    courseId: String(event.course),
    topicId: String(event.topicId || "unknown_topic"),
    sourceType: String(event.sourceType || "quiz"),
    eventType: String(event.eventType || "question_attempt"),
    eventTimestamp: new Date(event.eventTimestamp).toISOString(),
    label_nextCorrect: Number(Boolean(event.isCorrect)),
    difficulty: normalizeDifficulty(event.difficulty),
    timeSpentSec: Number(event.timeSpentSec || 0),
    hintUsed: Number(Boolean(event.hintUsed)),
  }));

  const outDir = path.join(process.cwd(), "ml", "data");
  await fs.mkdir(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const csvPath = path.join(outDir, `kt-sequence-${stamp}.csv`);
  const summaryPath = path.join(outDir, `kt-sequence-summary-${stamp}.json`);

  const headers = [
    "studentId",
    "courseId",
    "topicId",
    "sourceType",
    "eventType",
    "eventTimestamp",
    "label_nextCorrect",
    "difficulty",
    "timeSpentSec",
    "hintUsed",
  ];

  await fs.writeFile(csvPath, toCsv(rows, headers), "utf8");

  const summary = {
    generatedAt: new Date().toISOString(),
    lookbackDays,
    rows: rows.length,
    uniqueStudents: new Set(rows.map((r) => r.studentId)).size,
    uniqueTopics: new Set(rows.map((r) => r.topicId)).size,
    output: csvPath,
  };

  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  console.log("KT sequence dataset exported", summary);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("KT sequence export failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
