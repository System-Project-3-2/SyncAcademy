import "dotenv/config";
import mongoose from "mongoose";
import Course from "../models/courseModel.js";
import TopicTaxonomy from "../models/topicTaxonomyModel.js";
import TopicAlias from "../models/topicAliasModel.js";

const connect = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }
  await mongoose.connect(process.env.MONGO_URI);
};

const seedRows = [
  { unitId: "U1", unitName: "Foundations", topicId: "T1", topicName: "Problem Solving", subtopicId: "S1", subtopicName: "Algorithmic Thinking" },
  { unitId: "U1", unitName: "Foundations", topicId: "T1", topicName: "Problem Solving", subtopicId: "S2", subtopicName: "Complexity Basics" },
  { unitId: "U1", unitName: "Foundations", topicId: "T2", topicName: "Data Structures", subtopicId: "S1", subtopicName: "Arrays" },
  { unitId: "U1", unitName: "Foundations", topicId: "T2", topicName: "Data Structures", subtopicId: "S2", subtopicName: "Linked Lists" },
  { unitId: "U2", unitName: "Core Concepts", topicId: "T3", topicName: "Trees", subtopicId: "S1", subtopicName: "Binary Trees" },
  { unitId: "U2", unitName: "Core Concepts", topicId: "T3", topicName: "Trees", subtopicId: "S2", subtopicName: "BST Operations" },
  { unitId: "U2", unitName: "Core Concepts", topicId: "T4", topicName: "Sorting", subtopicId: "S1", subtopicName: "Merge Sort" },
  { unitId: "U2", unitName: "Core Concepts", topicId: "T4", topicName: "Sorting", subtopicId: "S2", subtopicName: "Quick Sort" },
  { unitId: "U3", unitName: "Applied", topicId: "T5", topicName: "Databases", subtopicId: "S1", subtopicName: "SQL Basics" },
  { unitId: "U3", unitName: "Applied", topicId: "T5", topicName: "Databases", subtopicId: "S2", subtopicName: "Joins" },
  { unitId: "U3", unitName: "Applied", topicId: "T6", topicName: "Networking", subtopicId: "S1", subtopicName: "OSI Model" },
  { unitId: "U3", unitName: "Applied", topicId: "T6", topicName: "Networking", subtopicId: "S2", subtopicName: "TCP and UDP" },
];

const aliasRows = [
  { alias: "time complexity", topicId: "T1", subtopicId: "S2" },
  { alias: "big o", topicId: "T1", subtopicId: "S2" },
  { alias: "array traversal", topicId: "T2", subtopicId: "S1" },
  { alias: "linked list", topicId: "T2", subtopicId: "S2" },
  { alias: "binary search tree", topicId: "T3", subtopicId: "S2" },
  { alias: "merge sort", topicId: "T4", subtopicId: "S1" },
  { alias: "quick sort", topicId: "T4", subtopicId: "S2" },
  { alias: "sql join", topicId: "T5", subtopicId: "S2" },
  { alias: "osi layers", topicId: "T6", subtopicId: "S1" },
  { alias: "tcp udp", topicId: "T6", subtopicId: "S2" },
];

const run = async () => {
  await connect();

  const courseId = process.env.TOPIC_SEED_COURSE_ID;
  const fallbackCourse = await Course.findOne().lean();
  const resolvedCourseId = courseId || fallbackCourse?._id;

  if (!resolvedCourseId) {
    throw new Error("No course found. Set TOPIC_SEED_COURSE_ID or create a course first.");
  }

  for (const row of seedRows) {
    await TopicTaxonomy.findOneAndUpdate(
      {
        course: resolvedCourseId,
        unitId: row.unitId,
        topicId: row.topicId,
        subtopicId: row.subtopicId,
      },
      {
        course: resolvedCourseId,
        ...row,
        status: "active",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  for (const row of aliasRows) {
    const normalizedAlias = row.alias
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    await TopicAlias.findOneAndUpdate(
      { course: resolvedCourseId, normalizedAlias, topicId: row.topicId, subtopicId: row.subtopicId },
      {
        course: resolvedCourseId,
        alias: row.alias,
        topicId: row.topicId,
        subtopicId: row.subtopicId,
        confidence: 0.85,
        source: "seed",
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  console.log("Topic taxonomy and aliases seeded", { courseId: String(resolvedCourseId) });
  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Seed failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
