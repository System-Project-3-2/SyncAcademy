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

const getDateRange = () => {
  const dateStr = process.env.KT_PIPELINE_DATE;
  const day = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(day.getTime())) throw new Error("KT_PIPELINE_DATE must be YYYY-MM-DD");
  const start = new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const run = async () => {
  await connect();
  const { start, end } = getDateRange();

  const allEvents = await LearningEvent.find({ eventTimestamp: { $lt: end } })
    .sort({ student: 1, course: 1, eventTimestamp: 1 })
    .lean();

  const rows = buildFeatureRows(allEvents);
  const dayRows = rows.filter((row) => {
    const ts = new Date(row.eventTimestamp).getTime();
    return ts >= start.getTime() && ts < end.getTime();
  });

  const summary = summarizeFeatureRows(dayRows);

  const outDir = path.join(process.cwd(), "reports");
  await fs.mkdir(outDir, { recursive: true });

  const stamp = start.toISOString().slice(0, 10);
  const jsonPath = path.join(outDir, `kt-feature-rows-${stamp}.json`);
  const csvPath = path.join(outDir, `kt-feature-rows-${stamp}.csv`);

  await fs.writeFile(
    jsonPath,
    JSON.stringify({
      pipelineDate: stamp,
      summary,
      rows: dayRows,
    }, null, 2),
    "utf8"
  );

  const headers = dayRows.length ? Object.keys(dayRows[0]) : [];
  await fs.writeFile(csvPath, toCsv(dayRows, headers), "utf8");

  console.log("KT feature pipeline completed", {
    pipelineDate: stamp,
    allEvents: allEvents.length,
    dayRows: dayRows.length,
    jsonPath,
    csvPath,
    summary,
  });

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("KT feature pipeline failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
