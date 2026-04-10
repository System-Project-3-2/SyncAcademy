import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import LearningEvent from "../models/learningEventModel.js";
import { buildFeatureRows, summarizeFeatureRows } from "../utils/ktFeaturePipeline.js";

const connect = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing");
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

  const lookbackDays = Number(process.env.KT_EXPORT_LOOKBACK_DAYS || 365);
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - lookbackDays);

  const events = await LearningEvent.find({
    eventTimestamp: { $gte: from },
    eventType: { $in: ["question_attempt", "assignment_attempt"] },
  })
    .sort({ student: 1, course: 1, eventTimestamp: 1 })
    .lean();

  const rows = buildFeatureRows(events, { includeOnlyQuestionEvents: true });
  const filtered = rows.filter((row) => row.label_nextCorrect != null);

  const outDir = path.join(process.cwd(), "ml", "data");
  await fs.mkdir(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const csvPath = path.join(outDir, `kt-training-${stamp}.csv`);
  const jsonPath = path.join(outDir, `kt-training-summary-${stamp}.json`);

  const headers = filtered.length ? Object.keys(filtered[0]) : [];
  await fs.writeFile(csvPath, toCsv(filtered, headers), "utf8");

  const summary = {
    generatedAt: new Date().toISOString(),
    lookbackDays,
    totalEvents: events.length,
    trainingRows: filtered.length,
    featureSummary: summarizeFeatureRows(filtered),
    csvPath,
  };
  await fs.writeFile(jsonPath, JSON.stringify(summary, null, 2), "utf8");

  console.log("KT training dataset exported", summary);

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("KT export failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
