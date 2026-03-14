import "dotenv/config";
import { Worker } from "bullmq";
import connectDB from "../config/db.js";
import { connectRedis } from "../config/redis.js";
import logger from "../observability/logger.js";
import { queueJobsTotal, queueDurationMs } from "../observability/metrics.js";
import JobStatus from "../models/jobStatusModel.js";
import { QUEUE_NAMES } from "../queues/queueNames.js";
import { queueConnection } from "../queues/connection.js";
import { embeddingProcessor } from "./processors/embeddingProcessor.js";
import { quizGenerationProcessor } from "./processors/quizGenerationProcessor.js";
import { documentParsingProcessor } from "./processors/documentParsingProcessor.js";
import { notificationProcessor } from "./processors/notificationProcessor.js";

await connectDB();
await connectRedis();

const concurrency = Number(process.env.WORKER_CONCURRENCY || 4);

const withTracking = (queueName, fn) => async (job) => {
  const start = Date.now();
  queueJobsTotal.inc({ queue: queueName, status: "active" }, 1);
  await JobStatus.findOneAndUpdate({ jobId: job.id }, { state: "active" }, { new: true });

  try {
    const result = await fn(job);
    queueJobsTotal.inc({ queue: queueName, status: "completed" }, 1);
    queueDurationMs.observe({ queue: queueName }, Date.now() - start);
    await JobStatus.findOneAndUpdate({ jobId: job.id }, { state: "completed", result }, { new: true });
    return result;
  } catch (err) {
    queueJobsTotal.inc({ queue: queueName, status: "failed" }, 1);
    await JobStatus.findOneAndUpdate({ jobId: job.id }, { state: "failed", error: err.message }, { new: true });
    throw err;
  }
};

const workers = [
  new Worker(QUEUE_NAMES.EMBEDDING, withTracking(QUEUE_NAMES.EMBEDDING, embeddingProcessor), {
    connection: queueConnection,
    concurrency,
  }),
  new Worker(QUEUE_NAMES.QUIZ_GENERATION, withTracking(QUEUE_NAMES.QUIZ_GENERATION, quizGenerationProcessor), {
    connection: queueConnection,
    concurrency,
  }),
  new Worker(QUEUE_NAMES.DOCUMENT_PARSING, withTracking(QUEUE_NAMES.DOCUMENT_PARSING, documentParsingProcessor), {
    connection: queueConnection,
    concurrency,
  }),
  new Worker(QUEUE_NAMES.NOTIFICATION_FANOUT, withTracking(QUEUE_NAMES.NOTIFICATION_FANOUT, notificationProcessor), {
    connection: queueConnection,
    concurrency,
  }),
];

workers.forEach((worker) => {
  worker.on("failed", (job, err) => {
    logger.error({ queue: worker.name, jobId: job?.id, err }, "Worker job failed");
  });

  worker.on("completed", (job) => {
    logger.info({ queue: worker.name, jobId: job?.id }, "Worker job completed");
  });
});

logger.info({ concurrency }, "Workers started");
