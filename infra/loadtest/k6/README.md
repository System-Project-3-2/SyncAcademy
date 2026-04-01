# Load Testing Guide for 1000 Concurrent Users

This directory contains K6 load test scripts optimized for testing the LMS backend at 1000 concurrent users.

## Prerequisites

1. **K6 Installation**
   ```bash
   # macOS
   brew install k6
   
   # Windows (via Chocolatey)
   choco install k6
   
   # Linux (Ubuntu/Debian)
   sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D3D0787F05B8B3F4EFA5
   echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6-stable.list
   sudo apt-get update
   sudo apt-get install k6
   ```

2. **Get Authentication Token**
   ```bash
   # First, generate a valid JWT token by logging in
   curl -X POST http://localhost:5000/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"student@example.com","password":"password123"}'
   # Copy the token from the response
   ```

3. **Get Test Resource IDs**
   ```bash
   # Get quiz ID
   curl -X GET http://localhost:5000/api/quizzes/my-created \
     -H "Authorization: Bearer <your_token>" | jq '.data[0]._id'
   
   # Get material ID
   curl -X GET http://localhost:5000/api/materials \
     -H "Authorization: Bearer <your_token>" | jq '.data[0]._id'
   
   # Get course ID
   curl -X GET http://localhost:5000/api/courses \
     -H "Authorization: Bearer <your_token>" | jq '.data[0]._id'
   ```

## Running Load Tests

### 1. Start Backend Stack Locally
```bash
cd infra
docker compose up --build
# Wait ~30s for services to be healthy

# Verify backend is running
curl http://localhost:5000/ops/healthz
# Should return {"status":"ok"}
```

### 2. Login and Get Token
```bash
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"teacher@test.com","password":"test123"}' | jq -r '.token')

echo "Token: $TOKEN"
```

### 3. Run Optimized 1000-User Load Test
```bash
cd infra/loadtest/k6

# Run with all parameters
k6 run optimized-load-test-1000.js \
  -e BASE_URL=http://localhost:5000 \
  -e TOKEN=$TOKEN \
  -e QUIZ_ID=<quiz_id> \
  -e MATERIAL_ID=<material_id> \
  -e COURSE_ID=<course_id> \
  --vus 1000 \
  --duration 5m

# Or use the default profile (ramps from 0 to 1000 over 2min, holds for 2min)
k6 run optimized-load-test-1000.js \
  -e BASE_URL=http://localhost:5000 \
  -e TOKEN=$TOKEN
```

## Expected Results

### ✅ Success Criteria (1000 Concurrent Users)

| Metric | Target | Notes |
|--------|--------|-------|
| **p95 Latency** | <500ms (avg) | 95th percentile response time across all endpoints |
| **Materials p95** | <400ms | Cached heavily, should be very fast |
| **Notifications p95** | <300ms | Most operations are READ, heavily cached |
| **Quiz p95** | <600ms | Some computation for grading |
| **Search p95** | <800ms | Depends on embedding service latency |
| **Chat p95** | <1000ms | Includes LLM call timeout (20s) + retry |
| **Error Rate** | <1% | Mostly from chat circuit breaker |
| **Successful Requests** | >99% | Should handle burst traffic smoothly |

### 📊 What to Monitor During Test

1. **Terminal Output** - K6 displays real-time metrics:
   ```
   http_req_duration...................: avg=245.3ms  min=12ms     med=180ms    max=2.4s     p(90)=450ms p(95)=520ms
   http_req_failed......................: 0.85%
   http_req_receiving...................: avg=540µs    min=100µs    med=500µs    max=50ms
   http_req_sending.....................: avg=150µs    min=50µs     med=100µs    max=25ms
   http_req_tls_handshaking.............: avg=0s       min=0s       med=0s       max=0s
   http_req_waiting.....................: avg=244.6ms  min=12ms     med=179ms    max=2.3s     p(95)=510ms
   http_reqs............................: 15234 in 5m
   iterations...........................: 12456 in 5m
   vus.................................: 50 min=0 max=1000
   vus_max.............................: 1000
   ```

2. **Prometheus Dashboard** (http://localhost:9090)
   - Navigate to: http://localhost:3000 (Grafana)
   - View "LMS API Overview" dashboard
   - Key metrics:
     - `lms_http_request_duration_ms` - Request latency histogram
     - `lms_http_requests_total` - Total requests (break down by status code)
     - `lms_queue_jobs_total` - Background job throughput
     - `lms_queue_duration_ms` - Job processing time

3. **MongoDB Connection Pool**
   ```bash
   # Check connection pool usage (in another terminal)
   curl http://localhost:5000/ops/metrics | grep "mongo\|pool" || echo "No pool metrics yet"
   ```

4. **Redis Memory Usage**
   ```bash
   # Check Redis hit/miss rates
   docker exec infra-redis-1 redis-cli INFO stats
   # Look for: hits, misses, hit_rate
   ```

## Interpreting Results

### 🟢 Green Lights (System is Healthy)
- [ ] p95 latency across all endpoints <500ms
- [ ] Error rate <1%
- [ ] No 429 (rate limit) responses
- [ ] Cache HIT rate >80% on GET endpoints
- [ ] Worker queue job success rate >99%
- [ ] Database connection pool healthy (max connections < 150/200)

### 🟡 Yellow Flags (Needs Attention)
- [ ] p95 latency 500-800ms - Consider enabling more aggressive caching
- [ ] Error rate 1-5% - Check if specific endpoints are failing
- [ ] Cache HIT rate 50-80% - Cache TTLs might be too short
- [ ] Worker queue backlog >5000 jobs - Scale workers horizontally

### 🔴 Red Flags (System Struggling)
- [ ] p95 latency >1000ms - DB pool exhausted or network bottleneck
- [ ] Error rate >5% - Too many failures, reduce VU or scale horizontally
- [ ] 429 (rate limit) responses - Adjust `RATE_LIMIT_MAX_PER_MINUTE` in .env
- [ ] Worker queue backlog >20000 jobs - Workers can't keep up
- [ ] Connection pool errors - Increase `MONGO_MAX_POOL_SIZE` or DB instance size

## Tuning for Better Performance

If results don't meet targets, try these adjustments:

### 1. Increase Redis Cache TTL
```bash
# In .env
API_CACHE_TTL_SECONDS=600  # 10 minutes (instead of 300)
SEARCH_CACHE_TTL_SECONDS=600
```

### 2. Scale MongoDB Connection Pool
```bash
# In .env
MONGO_MAX_POOL_SIZE=300  # Increased from 200
MONGO_MIN_POOL_SIZE=100   # Increased from 50
```

### 3. Scale Worker Concurrency
```bash
# Run more workers with higher concurrency
docker run --name lms-worker-2 \
  -e WORKER_CONCURRENCY=30 \
  -e REDIS_URL=redis://redis:6379 \
  -e MONGO_URI=mongodb://mongo:27017/lms \
  lms-worker:latest
```

### 4. Disable Unnecessary Middleware
```bash
# In .env, disable if not needed
LOG_LEVEL=warn  # Reduce logging overhead
ENABLE_API_CACHE=true  # Keep cache enabled
```

### 5. Enable Connection Pooling in Redis
```bash
# Already enabled with ioredis, but verify:
# backend/config/redis.js - maxRetriesPerRequest: 3, enableReadyCheck: false
```

## Load Test Scenarios

### Scenario 1: Ramp to Peak (0 → 1000 users)
**What it tests:** Gradual load increase to identify breaking point
```bash
k6 run optimized-load-test-1000.js -e BASE_URL=http://localhost:5000 -e TOKEN=$TOKEN
```

### Scenario 2: Sustained Load (hold at 1000 users)
**What it tests:** System stability under sustained peak load
```bash
k6 run optimized-load-test-1000.js \
  --stage 1m:1000 \
  --stage 5m:1000 \
  --stage 1m:0 \
  -e BASE_URL=http://localhost:5000 \
  -e TOKEN=$TOKEN
```

### Scenario 3: Spike Test (1000 → 5000 users instantly)
**What it tests:** System resilience to traffic spikes
```bash
k6 run optimized-load-test-1000.js \
  --stage 30s:1000 \
  --stage 30s:5000 \
  --stage 1m:5000 \
  --stage 30s:0 \
  -e BASE_URL=http://localhost:5000 \
  -e TOKEN=$TOKEN
```

## Continuous Load Testing (CI/CD Integration)

To automate load testing in your CI/CD pipeline:

```bash
# .github/workflows/load-test.yml
name: Load Test
on: [push, pull_request]
jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - run: docker compose -f infra/docker-compose.yml up -d
      - run: sleep 30  # Wait for services
      - run: |
          k6 run infra/loadtest/k6/optimized-load-test-1000.js \
            -e BASE_URL=http://localhost:5000 \
            -e TOKEN=${{ secrets.TEST_TOKEN }} \
            --out json=results.json
      - run: |
          # Fail if p95 > 500ms
          cat results.json | jq '.metrics | select(.["http_req_duration"].values.p95 > 500)' && exit 1 || true
```

## Troubleshooting

### Issue: "Too many requests" (429) errors
**Solution:** Increase `RATE_LIMIT_MAX_PER_MINUTE` in .env
```bash
RATE_LIMIT_MAX_PER_MINUTE=50000  # Increased from 20000
```

### Issue: Database connection timeout errors
**Solution:** Increase MongoDB pool size
```bash
MONGO_MAX_POOL_SIZE=500
MONGO_MIN_POOL_SIZE=200
```

### Issue: Redis OutOfMemory errors
**Solution:** Increase Redis memory limit or reduce cache TTL
```bash
# In docker-compose.yml
redis:
  command: redis-server --maxmemory 2gb --maxmemory-policy allkeys-lru
```

### Issue: K6 script errors (invalid token, resource IDs)
**Solution:** Verify token is still valid and resource IDs exist
```bash
# Check token validity
curl -X GET http://localhost:5000/api/quizzes/my-created \
  -H "Authorization: Bearer $TOKEN"

# If 401, re-generate token
```

## Next Steps

1. **Run baseline load test** - Establish current performance metrics
2. **Identify bottlenecks** - Use profiling output to find slow endpoints
3. **Apply optimizations** - Increase cache TTLs, scale workers, etc.
4. **Re-test and compare** - Verify improvements
5. **Document results** - Add to SCALING_IMPLEMENTATION_PLAN.md

---

**Questions?** Check SCALING_IMPLEMENTATION_PLAN.md for more detailed architecture advice.
