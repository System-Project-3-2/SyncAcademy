import pinoHttp from "pino-http";
import { randomUUID } from "crypto";
import logger from "../observability/logger.js";
import { httpRequestDurationMs, httpRequestsTotal } from "../observability/metrics.js";

export const requestLogger = pinoHttp({
  logger,
  genReqId: (req) => req.headers["x-request-id"] || randomUUID(),
  customLogLevel: (_req, res, err) => {
    if (err || res.statusCode >= 500) return "error";
    if (res.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (req, res) => `${req.method} ${req.url} ${res.statusCode}`,
});

export const requestMetrics = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on("finish", () => {
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1e6;
    const route = req.route?.path ? `${req.baseUrl || ""}${req.route.path}` : req.path;
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };

    httpRequestsTotal.inc(labels, 1);
    httpRequestDurationMs.observe(labels, durationMs);
  });

  next();
};
