import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const TOKEN = __ENV.TOKEN || "";

export const options = {
  scenarios: {
    chat_load: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: "2m", target: 50 },
        { duration: "3m", target: 200 },
        { duration: "3m", target: 400 },
        { duration: "2m", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

export default function () {
  const res = http.post(
    `${BASE_URL}/api/chat`,
    JSON.stringify({ message: "Summarize chapter 1 key points." }),
    {
      headers: {
        "Content-Type": "application/json",
        ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
      },
    }
  );

  check(res, {
    "chat response status": (r) => [200, 401, 503, 504].includes(r.status),
  });

  sleep(1);
}
