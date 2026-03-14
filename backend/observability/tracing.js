export const startTracing = async () => {
  // Placeholder hook for future OpenTelemetry wiring.
  if (process.env.OTEL_ENABLED === "true") {
    console.log("[Tracing] OTEL_ENABLED=true but external tracer is not configured in this build");
  }
};

export const stopTracing = async () => {
  return Promise.resolve();
};
