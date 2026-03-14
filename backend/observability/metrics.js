import client from "prom-client";

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: "lms_" });

export const httpRequestDurationMs = new client.Histogram({
  name: "lms_http_request_duration_ms",
  help: "HTTP request duration in milliseconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [25, 50, 100, 200, 300, 400, 600, 1000, 2000, 5000],
});

export const httpRequestsTotal = new client.Counter({
  name: "lms_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

export const queueJobsTotal = new client.Counter({
  name: "lms_queue_jobs_total",
  help: "Total jobs produced/processed in queues",
  labelNames: ["queue", "status"],
});

export const queueDurationMs = new client.Histogram({
  name: "lms_queue_job_duration_ms",
  help: "Queue job processing duration",
  labelNames: ["queue"],
  buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
});

register.registerMetric(httpRequestDurationMs);
register.registerMetric(httpRequestsTotal);
register.registerMetric(queueJobsTotal);
register.registerMetric(queueDurationMs);

export const getMetrics = async () => register.metrics();
export { register };
