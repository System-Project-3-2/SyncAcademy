import Redis from "ioredis";
import logger from "../observability/logger.js";

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

let redis;

export const getRedis = () => {
  if (redis) return redis;

  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 100, 2000),
  });

  redis.on("error", (err) => {
    logger.error({ err }, "Redis connection error");
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
