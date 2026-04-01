# Load Testing Guide

## Prerequisites
- Install k6: https://k6.io/docs/get-started/installation/
- Start backend and worker services.

## Quiz Flow Test (up to 2000 VUs)

```bash
k6 run infra/loadtest/k6/quiz-traffic.js \
  -e BASE_URL=http://localhost:5000 \
  -e TOKEN=<student-jwt> \
  -e COURSE_ID=<course-id> \
  -e QUIZ_ID=<quiz-id>
```

## Chat Flow Test

```bash
k6 run infra/loadtest/k6/chat-traffic.js \
  -e BASE_URL=http://localhost:5000 \
  -e TOKEN=<student-jwt>
```

## What to watch
- `p95` latency under 400ms for core APIs.
- Error rate below 1%.
- Queue depth growth and worker lag.
- Mongo connection utilization.
- Redis hit ratio for cache endpoints.
