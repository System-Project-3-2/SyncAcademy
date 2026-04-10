import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import mongoose from "mongoose";
import LearningEvent from "../models/learningEventModel.js";
import { buildFeatureRows, summarizeFeatureRows } from "../utils/ktFeaturePipeline.js";
import {
  computeNullRates,
  detectDuplicateEvents,
  detectTimestampAnomalies,
  computeWeeklyDistributionShift,
  buildReadinessSummary,
} from "../utils/ktDataQuality.js";

const connect = async () => {
  if (!process.env.MONGO_URI) throw new Error("MONGO_URI is missing");
  await mongoose.connect(process.env.MONGO_URI);
};

const run = async () => {
  await connect();

  const days = Math.max(7, Number(process.env.KT_DQ_LOOKBACK_DAYS || 56));
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);

  const events = await LearningEvent.find({ eventTimestamp: { $gte: start } })
    .sort({ eventTimestamp: 1 })
    .lean();

  const featureRows = buildFeatureRows(events);

  const nullRates = computeNullRates(events, [
    "student",
    "course",
    "topicId",
    "sourceType",
    "eventType",
    "questionId",
    "isCorrect",
    "difficulty",
    "timeSpentSec",
    "eventTimestamp",
  ]);

  const duplicates = detectDuplicateEvents(events);
  const anomalies = detectTimestampAnomalies(events);
  const distribution = computeWeeklyDistributionShift(events);

  const readiness = buildReadinessSummary({
    events,
    featureRows,
    nullRates,
    duplicates,
    anomalies,
    distribution,
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    lookbackDays: days,
    readiness,
    featureSummary: summarizeFeatureRows(featureRows),
    samples: {
      duplicateEvents: duplicates.slice(0, 25),
      futureTimestampEvents: anomalies.futureEvents.slice(0, 25),
      outOfOrderEvents: anomalies.outOfOrder.slice(0, 25),
    },
  };

  const outDir = path.join(process.cwd(), "reports");
  await fs.mkdir(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(outDir, `kt-data-quality-${stamp}.json`);
  await fs.writeFile(reportPath, JSON.stringify(payload, null, 2), "utf8");

  console.log("KT data quality report generated", {
    reportPath,
    readyForTraining: readiness.readyForTraining,
    totals: readiness.totals,
  });

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("KT data quality report failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
