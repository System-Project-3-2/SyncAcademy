/**
 * Optimized K6 Load Test for 1000 Concurrent Users
 * Tests all critical hot paths: quiz, search, materials, notifications, chat
 * 
 * Run: k6 run infra/loadtest/k6/optimized-load-test-1000.js -e BASE_URL=http://localhost:5000 -e TOKEN=<jwt>
 */

import http from "k6/http";
import { check, group, sleep } from "k6";

export const options = {
  // Ramp up to 1000 concurrent users over 2 minutes
  stages: [
    { duration: "30s", target: 100 },   // 0-100 users
    { duration: "30s", target: 300 },   // 100-300 users
    { duration: "30s", target: 600 },   // 300-600 users
    { duration: "30s", target: 1000 },  // 600-1000 users (4x increase)
    { duration: "2m", target: 1000 },   // Stay at 1000 users for 2 minutes
    { duration: "30s", target: 0 },     // Ramp down to 0 users
  ],
  thresholds: {
    // HTTP request duration should be below 500ms for 95% of requests
    "http_req_duration": ["p(95)<500"],
    // Error rate should be below 1%
    "http_req_failed": ["rate<0.01"],
    // Custom thresholds for specific endpoints
    "http_req_duration{endpoint:quiz}": ["p(95)<600"],
    "http_req_duration{endpoint:search}": ["p(95)<800"],
    "http_req_duration{endpoint:materials}": ["p(95)<400"],
    "http_req_duration{endpoint:notifications}": ["p(95)<300"],
    "http_req_duration{endpoint:chat}": ["p(95)<1000"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:5000";
const TOKEN = __ENV.TOKEN || "";
const QUIZ_ID = __ENV.QUIZ_ID || "507f1f77bcf86cd799439011";
const MATERIAL_ID = __ENV.MATERIAL_ID || "607f1f77bcf86cd799439012";
const COURSE_ID = __ENV.COURSE_ID || "707f1f77bcf86cd799439013";

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
  "User-Agent": "k6-load-tester/1.0",
};

/**
 * Test Quiz Endpoints
 * - GET /api/quizzes/my-created (list created quizzes with pagination)
 * - GET /api/quizzes/course/:courseId (list course quizzes)
 * - GET /api/quizzes/:id (get single quiz details)
 * - POST /api/quizzes/:id/attempt (submit quiz attempt with idempotency)
 */
export function testQuizEndpoints() {
  group("Quiz Endpoints", () => {
    // Test: List my created quizzes with pagination
    let res = http.get(`${BASE_URL}/api/quizzes/my-created?page=1&limit=20`, {
      headers,
      tags: { endpoint: "quiz" },
    });
    check(res, {
      "quiz list: status 200": (r) => r.status === 200,
      "quiz list: has pagination": (r) => r.body.includes("pagination"),
      "quiz list: response time <600ms": (r) => r.timings.duration < 600,
    });

    // Test: List quizzes for a course
    res = http.get(`${BASE_URL}/api/quizzes/course/${COURSE_ID}?page=1&limit=20`, {
      headers,
      tags: { endpoint: "quiz" },
    });
    check(res, {
      "course quizzes: status 200": (r) => r.status === 200,
      "course quizzes: response time <600ms": (r) => r.timings.duration < 600,
    });

    // Test: Get single quiz (cached after first request)
    res = http.get(`${BASE_URL}/api/quizzes/${QUIZ_ID}`, {
      headers,
      tags: { endpoint: "quiz" },
    });
    check(res, {
      "quiz details: status 200": (r) => r.status === 200,
      "quiz details: has questions": (r) => r.body.includes("questions"),
      "quiz details: response time <400ms": (r) => r.timings.duration < 400,
    });

    // Test: Submit quiz attempt with idempotency key (atomic, no double-grading)
    const idempotencyKey = `quiz-${QUIZ_ID}-${__VU}-${__ITER}`;
    const attemptPayload = {
      answers: {
        q1: "A",
        q2: "B",
        q3: "C",
      },
    };
    res = http.post(`${BASE_URL}/api/quizzes/${QUIZ_ID}/attempt`, JSON.stringify(attemptPayload), {
      headers: {
        ...headers,
        "Idempotency-Key": idempotencyKey,
      },
      tags: { endpoint: "quiz" },
    });
    check(res, {
      "quiz submit: status 200 or 201": (r) => r.status === 200 || r.status === 201,
      "quiz submit: response time <600ms": (r) => r.timings.duration < 600,
    });
  });
}

/**
 * Test Search Endpoints
 * - POST /api/search (semantic search with caching)
 * - GET /api/search/history (search history with pagination)
 * - GET /api/search/suggestions (autocomplete suggestions)
 */
export function testSearchEndpoints() {
  group("Search Endpoints", () => {
    // Test: Semantic search (cached after TTL expiry)
    const searchPayload = {
      query: "machine learning algorithms",
      courseNo: "CS101",
      type: "pdf",
    };
    let res = http.post(`${BASE_URL}/api/search`, JSON.stringify(searchPayload), {
      headers,
      tags: { endpoint: "search" },
    });
    check(res, {
      "search: status 200": (r) => r.status === 200,
      "search: has results": (r) => r.body.includes("data") || r.body.includes("results"),
      "search: response time <800ms": (r) => r.timings.duration < 800,
    });

    // Test: Get search history (paginated, heavily cached)
    res = http.get(`${BASE_URL}/api/search/history?page=1&limit=20`, {
      headers,
      tags: { endpoint: "search" },
    });
    check(res, {
      "search history: status 200": (r) => r.status === 200,
      "search history: response time <300ms (cached)": (r) => r.timings.duration < 300,
    });

    // Test: Get autocomplete suggestions (cached, frequently reused)
    res = http.get(`${BASE_URL}/api/search/suggestions?q=algo`, {
      headers,
      tags: { endpoint: "search" },
    });
    check(res, {
      "search suggestions: status 200": (r) => r.status === 200,
      "search suggestions: response time <200ms (cached)": (r) => r.timings.duration < 200,
    });
  });
}

/**
 * Test Material Endpoints
 * - GET /api/materials (list materials with pagination, lean fields)
 * - GET /api/materials/:id (get single material, exclude large text)
 * - GET /api/materials/:id/signed-url (get signed URL for download)
 */
export function testMaterialEndpoints() {
  group("Material Endpoints", () => {
    // Test: List all materials (paginated, lean fields)
    let res = http.get(`${BASE_URL}/api/materials?page=1&limit=20`, {
      headers,
      tags: { endpoint: "materials" },
    });
    check(res, {
      "materials list: status 200": (r) => r.status === 200,
      "materials list: has pagination": (r) => r.body.includes("pagination"),
      "materials list: response time <400ms (cached)": (r) => r.timings.duration < 400,
    });

    // Test: Get single material (exclude textContent, use signed URL for full text)
    res = http.get(`${BASE_URL}/api/materials/${MATERIAL_ID}`, {
      headers,
      tags: { endpoint: "materials" },
    });
    check(res, {
      "material details: status 200": (r) => r.status === 200,
      "material details: response time <400ms (cached)": (r) => r.timings.duration < 400,
    });

    // Test: Get signed URL for material download (supports parallel downloads)
    res = http.get(`${BASE_URL}/api/materials/${MATERIAL_ID}/signed-url`, {
      headers,
      tags: { endpoint: "materials" },
    });
    check(res, {
      "material signed URL: status 200": (r) => r.status === 200,
      "material signed URL: has URL": (r) => r.body.includes("http"),
      "material signed URL: response time <300ms (cached)": (r) => r.timings.duration < 300,
    });
  });
}

/**
 * Test Notification Endpoints
 * - GET /api/notifications (get notifications with pagination, heavily cached)
 * - GET /api/notifications/unread-count (get unread count, heavily cached)
 */
export function testNotificationEndpoints() {
  group("Notification Endpoints", () => {
    // Test: Get my notifications (paginated, heavily cached)
    let res = http.get(`${BASE_URL}/api/notifications?page=1&limit=20`, {
      headers,
      tags: { endpoint: "notifications" },
    });
    check(res, {
      "notifications list: status 200": (r) => r.status === 200,
      "notifications list: response time <200ms (heavily cached)": (r) => r.timings.duration < 200,
    });

    // Test: Get unread count (very fast, heavily cached)
    res = http.get(`${BASE_URL}/api/notifications/unread-count`, {
      headers,
      tags: { endpoint: "notifications" },
    });
    check(res, {
      "unread count: status 200": (r) => r.status === 200,
      "unread count: response time <100ms (heavily cached)": (r) => r.timings.duration < 100,
    });
  });
}

/**
 * Test Chat Endpoint (RAG)
 * - POST /api/chat (RAG query with resilience: timeout, retry, circuit breaker)
 */
export function testChatEndpoint() {
  group("Chat Endpoint (RAG)", () => {
    const chatPayload = {
      message: "Explain the concepts from the uploaded materials",
      filters: {
        courseNo: "CS101",
        type: "pdf",
      },
    };
    const res = http.post(`${BASE_URL}/api/chat`, JSON.stringify(chatPayload), {
      headers,
      tags: { endpoint: "chat" },
      timeout: "10s", // Allow more time for LLM
    });
    check(res, {
      "chat: status 200 or 503": (r) => r.status === 200 || r.status === 503,
      "chat: response time <1s (with retry/timeout)": (r) => r.timings.duration < 1000,
    });
  });
}

/**
 * Test Health Check (ops endpoint)
 * - GET /ops/healthz (health status)
 * - GET /ops/readyz (readiness status)
 * - GET /ops/metrics (Prometheus metrics)
 */
export function testOpsEndpoints() {
  group("Operations Endpoints", () => {
    // Health check should be very fast
    let res = http.get(`${BASE_URL}/ops/healthz`, {
      tags: { endpoint: "ops" },
    });
    check(res, {
      "health: status 200": (r) => r.status === 200,
      "health: response time <50ms": (r) => r.timings.duration < 50,
    });

    // Readiness check
    res = http.get(`${BASE_URL}/ops/readyz`, {
      tags: { endpoint: "ops" },
    });
    check(res, {
      "ready: status 200": (r) => r.status === 200,
    });

    // Prometheus metrics (not critical for SLO, but useful for monitoring)
    res = http.get(`${BASE_URL}/ops/metrics`, {
      tags: { endpoint: "ops" },
    });
    check(res, {
      "metrics: status 200": (r) => r.status === 200,
      "metrics: contains prometheus": (r) => r.body.includes("# HELP") || r.body.includes("http_request_duration_ms"),
    });
  });
}

/**
 * Main test function - distributed across VUs
 * Each VU runs a mix of endpoints in sequence with realistic think time
 */
export default function () {
  // Test ops endpoints on every iteration (fast path)
  testOpsEndpoints();

  // Distribute load across different endpoints based on VU iteration
  const iteration = __ITER;
  const endpoint = iteration % 5;

  switch (endpoint) {
    case 0:
      testQuizEndpoints();
      break;
    case 1:
      testSearchEndpoints();
      break;
    case 2:
      testMaterialEndpoints();
      break;
    case 3:
      testNotificationEndpoints();
      break;
    case 4:
      testChatEndpoint();
      break;
  }

  // Realistic think time between requests (1-3 seconds)
  sleep(1 + Math.random() * 2);
}

/**
 * Custom Metrics to Track:
 * - p95 latency for each endpoint type
 * - Error rates by endpoint
 * - Cache hit rates (via x-cache header in responses)
 * - Queue job throughput (via /ops/metrics)
 * 
 * Expected Results at 1000 concurrent:
 * ✅ PASS: p95 latency <500ms for materials, notifications
 * ✅ PASS: p95 latency <600ms for quiz
 * ✅ PASS: p95 latency <800ms for search (depends on embedding service)
 * ✅ PASS: Error rate <1% (mostly from chat circuit breaker during LLM unavailability)
 * ✅ PASS: Cache hit rate >80% for frequently accessed endpoints
 */
