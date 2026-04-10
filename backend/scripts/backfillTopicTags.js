import "dotenv/config";
import mongoose from "mongoose";
import Quiz from "../models/quizModel.js";
import Material from "../models/materialModel.js";

const connect = async () => {
  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }
  await mongoose.connect(process.env.MONGO_URI);
};

const run = async () => {
  await connect();

  const quizResult = await Quiz.updateMany(
    { "questions.topicTags": { $exists: false } },
    { $set: { "questions.$[].topicTags": [] } }
  );

  const materialResult = await Material.updateMany(
    { topicTags: { $exists: false } },
    { $set: { topicTags: [] } }
  );

  console.log("Backfill complete");
  console.log({
    quizMatched: quizResult.matchedCount,
    quizModified: quizResult.modifiedCount,
    materialMatched: materialResult.matchedCount,
    materialModified: materialResult.modifiedCount,
  });

  await mongoose.disconnect();
};

run().catch(async (error) => {
  console.error("Backfill failed:", error.message);
  await mongoose.disconnect();
  process.exit(1);
});
