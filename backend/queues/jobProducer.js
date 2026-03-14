import { embeddingQueue, quizGenerationQueue, documentParsingQueue, notificationFanoutQueue } from "./index.js";

export const enqueueEmbeddingJob = async (payload) =>
  embeddingQueue.add("generate-embeddings", payload, { jobId: payload.jobId });

export const enqueueQuizGenerationJob = async (payload) =>
  quizGenerationQueue.add("generate-quiz", payload, { jobId: payload.jobId });

export const enqueueDocumentParsingJob = async (payload) =>
  documentParsingQueue.add("parse-document", payload, { jobId: payload.jobId });

export const enqueueNotificationFanoutJob = async (payload) =>
  notificationFanoutQueue.add("notify-users", payload, { jobId: payload.jobId });
