import Redis from "ioredis";
import logger from "../observability/logger.js";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redis;

export const getRedis = () => {
  if (redis) return redis;

  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    enableOfflineQueue: false,
    lazyConnect: true,
    retryStrategy: () => null, // Don't retry automatically
  });

  redis.on("error", () => {
    // Silently ignore - Redis is optional for this app
  });

  redis.on("connect", () => {
    logger.info("Redis connected");
  });

  return redis;
};

export const connectRedis = async () => {
  const client = getRedis();
  if (client.status !== "ready") {
    try {
      await client.connect();
    } catch (err) {
      logger.warn({ err }, "Redis unavailable, continuing without hard failure");
    }
  }
  return client;
};
