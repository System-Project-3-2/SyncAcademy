import { Queue } from "bullmq";
import { queueConnection } from "./connection.js";
import { QUEUE_NAMES } from "./queueNames.js";

export const embeddingQueue = new Queue(QUEUE_NAMES.EMBEDDING, {
  connection: queueConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: 100, removeOnFail: 500 },
});

export const quizGenerationQueue = new Queue(QUEUE_NAMES.QUIZ_GENERATION, {
  connection: queueConnection,
  defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 100, removeOnFail: 500 },
});

export const documentParsingQueue = new Queue(QUEUE_NAMES.DOCUMENT_PARSING, {
  connection: queueConnection,
  defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 2000 }, removeOnComplete: 100, removeOnFail: 500 },
});

export const notificationFanoutQueue = new Queue(QUEUE_NAMES.NOTIFICATION_FANOUT, {
  connection: queueConnection,
  defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: 100, removeOnFail: 500 },
});
