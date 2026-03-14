import { getRedis } from "../config/redis.js";

const defaultTtl = Number(process.env.API_CACHE_TTL_SECONDS || 60);

const buildKey = (req) => {
  const userPart = req.user?._id ? `u:${req.user._id}` : "anon";
  return `api:${userPart}:${req.originalUrl}`;
};

export const cacheGet = ({ ttl = defaultTtl } = {}) => async (req, res, next) => {
  if (process.env.ENABLE_API_CACHE !== "true") return next();
  if (req.method !== "GET") return next();

  const redis = getRedis();
  if (redis.status !== "ready") return next();

  const key = buildKey(req);
  const cached = await redis.get(key);
  if (cached) {
    res.set("x-cache", "HIT");
    return res.status(200).json(JSON.parse(cached));
  }

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    res.set("x-cache", "MISS");
    redis.setex(key, ttl, JSON.stringify(payload)).catch(() => {});
    return originalJson(payload);
  };

  next();
};

export const cacheInvalidateByPrefix = async (prefix) => {
  if (process.env.ENABLE_API_CACHE !== "true") return;
  const redis = getRedis();
  if (redis.status !== "ready") return;

  const keys = await redis.keys(`${prefix}*`);
  if (keys.length) await redis.del(keys);
};
