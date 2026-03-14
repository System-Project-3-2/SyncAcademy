import crypto from "crypto";
import { getRedis } from "../config/redis.js";

const ttlSeconds = Number(process.env.IDEMPOTENCY_TTL_SECONDS || 900);

export const requireIdempotencyKey = (req, res, next) => {
  const key = req.headers["idempotency-key"];
  if (!key) {
    return res.status(400).json({ message: "idempotency-key header is required" });
  }
  req.idempotencyKey = String(key);
  next();
};

export const idempotencyGuard = (scopeBuilder) => async (req, res, next) => {
  const redis = getRedis();
  if (redis.status !== "ready") return next();

  const payloadHash = crypto
    .createHash("sha256")
    .update(JSON.stringify(req.body || {}))
    .digest("hex");

  const scope = scopeBuilder(req);
  const key = `idem:${scope}:${req.idempotencyKey}`;
  const existing = await redis.get(key);

  if (existing) {
    const parsed = JSON.parse(existing);
    if (parsed.payloadHash !== payloadHash) {
      return res.status(409).json({ message: "Idempotency key reused with a different payload" });
    }
    return res.status(parsed.status || 200).json(parsed.response);
  }

  const originalJson = res.json.bind(res);
  res.json = (payload) => {
    const status = res.statusCode || 200;
    const value = JSON.stringify({ payloadHash, status, response: payload });
    redis.setex(key, ttlSeconds, value).catch(() => {});
    return originalJson(payload);
  };

  next();
};

export const withDistributedLock = async (lockKey, ttlMs, fn) => {
  const redis = getRedis();
  if (redis.status !== "ready") {
    return fn();
  }

  const token = crypto.randomUUID();
  const acquired = await redis.set(lockKey, token, "PX", ttlMs, "NX");
  if (!acquired) {
    const err = new Error("Resource is busy. Please retry.");
    err.code = "LOCK_NOT_ACQUIRED";
    throw err;
  }

  try {
    return await fn();
  } finally {
    const current = await redis.get(lockKey);
    if (current === token) {
      await redis.del(lockKey);
    }
  }
};
