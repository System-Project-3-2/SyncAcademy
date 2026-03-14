import { getRedis } from "../config/redis.js";

export const queueConnection = getRedis();
