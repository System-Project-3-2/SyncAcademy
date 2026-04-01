# Student-Aid-Semantic-Search

## Scaling Architecture

See `SCALING_IMPLEMENTATION_PLAN.md` for the full 8-phase production scaling plan and implementation details.

## Local High-Scale Stack

```bash
cd infra
docker compose up --build
```

Services:
- API: `http://localhost:5000`
- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`

## Worker Process

If you run backend manually, start workers separately:

```bash
cd backend
npm run worker
```

## Load Testing

Scripts are in `infra/loadtest/k6`.

```bash
k6 run infra/loadtest/k6/quiz-traffic.js -e BASE_URL=http://localhost:5000 -e TOKEN=<jwt> -e QUIZ_ID=<id>
```