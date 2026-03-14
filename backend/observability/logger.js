import pino from "pino";

const level = process.env.LOG_LEVEL || "info";

const logger = pino({
  level,
  base: undefined,
  redact: {
    paths: [
      "req.headers.authorization",
      "headers.authorization",
      "password",
      "token",
      "otp",
    ],
    remove: true,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export default logger;
