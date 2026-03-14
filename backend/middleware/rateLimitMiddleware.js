import { rateLimit } from "express-rate-limit";
import slowDown from "express-slow-down";
import { RedisStore } from "rate-limit-redis";
import { getRedis } from "../config/redis.js";

const makeStore = () => {
  if (process.env.RATE_LIMIT_USE_REDIS !== "true") return undefined;
  const redis = getRedis();
  return new RedisStore({
    sendCommand: (...args) => redis.call(...args),
  });
};

export const globalRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_PER_MINUTE || 300),
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(),
  message: { message: "Too many requests, please try again shortly." },
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX || 60),
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(),
  message: { message: "Too many auth requests, please try later." },
});

export const apiThrottle = slowDown({
  windowMs: 60 * 1000,
  delayAfter: Number(process.env.THROTTLE_AFTER || 120),
  delayMs: () => Number(process.env.THROTTLE_DELAY_MS || 150),
});
