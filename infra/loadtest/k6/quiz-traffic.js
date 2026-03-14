import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const TOKEN = __ENV.TOKEN || "";
const QUIZ_ID = __ENV.QUIZ_ID || "";

export const options = {
  scenarios: {
    steady_users: {
      executor: "ramping-vus",
      startVUs: 10,
      stages: [
        { duration: "2m", target: 100 },
        { duration: "3m", target: 500 },
        { duration: "3m", target: 1000 },
        { duration: "4m", target: 2000 },
        { duration: "2m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<400"],
  },
};

const authHeaders = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};

export default function () {
  const idempotency = `${__VU}-${__ITER}-${Date.now()}`;

  const listRes = http.get(`${BASE_URL}/api/quizzes/course/${QUIZ_ID}`, {
    headers: { ...authHeaders },
  });
  check(listRes, { "list quizzes ok": (r) => r.status === 200 || r.status === 403 || r.status === 404 });

  const payload = JSON.stringify({
    answers: [
      { questionIndex: 0, selectedAnswer: 1 },
      { questionIndex: 1, selectedAnswer: 2 },
    ],
    startedAt: new Date(Date.now() - 120000).toISOString(),
  });

  const submitRes = http.post(`${BASE_URL}/api/quizzes/${QUIZ_ID}/attempt`, payload, {
    headers: {
      "Content-Type": "application/json",
      "idempotency-key": idempotency,
      ...authHeaders,
    },
  });

  check(submitRes, {
    "submit handled": (r) => [201, 400, 401, 403, 404, 429].includes(r.status),
  });

  sleep(1);
}
