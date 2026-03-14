import express from "express";
import { getMetrics } from "../observability/metrics.js";

const router = express.Router();

router.get("/healthz", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: process.uptime() });
});

router.get("/readyz", (_req, res) => {
  res.json({ status: "ready" });
});

router.get("/metrics", async (_req, res) => {
  const metrics = await getMetrics();
  res.set("Content-Type", "text/plain; version=0.0.4");
  res.send(metrics);
});

export default router;
