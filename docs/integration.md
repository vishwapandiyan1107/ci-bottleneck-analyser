# CI Integration Stub

The application exposes the existing tRPC API under `/api/trpc` plus a provider-neutral REST webhook boundary. The same deterministic parser/validation/analysis engine is shared by the dashboard, calculated REST endpoint and webhook ingress.

## tRPC procedures
- `analysis.overview`
- `analysis.demo`
- `analysis.analyseCsv`
- `analysis.settings`
- `analysis.updateSettings`
- `analysis.recommendations`
- `analysis.recommendationAction`
- `analysis.audit`

## Webhook / streaming simulation
- `GET /api/analysis` — calculated analysis from the canonical validation dataset.
- `GET /api/integration/health` — contract and provider list.
- `POST /api/integration/ci-events` — canonical webhook/stream event ingestion.
- `POST /api/integration/webhooks/:provider` — provider-native webhook simulation that normalizes GitHub Actions, GitLab CI, Jenkins or generic payloads into the canonical schema before invoking the same validation/analysis/audit pipeline.

The canonical POST endpoint accepts either one canonical CI record or a small batch. Each request represents one streaming/webhook delivery. `eventId` is stored and duplicate deliveries return HTTP 409, providing idempotency.

The provider-native endpoint reads an event id from `x-event-id` (or the body), an event type from `x-ci-event` (or the body), and maps common native fields such as GitHub `run_id/ref/conclusion`, GitLab `job_name/status`, or Jenkins `job_name/result` into the canonical telemetry fields. The adapter deliberately stops at ingestion: no external CI configuration is mutated. In a production phase, authentication/signature verification, provider-specific log retrieval, rate limiting and outbound configuration clients would be added around this same boundary.

Supported provider identifiers:
- `github-actions`
- `gitlab-ci`
- `jenkins`
- `generic`

Canonical required fields:
`buildId,pipeline,branch,durationSec,queueSec,cacheHitPct,agentUtilPct,status,task,taskDurationSec,taskMedianSec,dependencyKnown,parallelCandidate,sequentialSec,parallelSec`

Optional timestamp fields:
`queuedAt,startedAt,completedAt`

## Example request

```bash
curl -X POST http://localhost:3000/api/integration/ci-events \
  -H "Content-Type: application/json" \
  -d '{
    "provider":"github-actions",
    "eventId":"evt-001",
    "eventType":"agent.log",
    "record":{
      "buildId":"build-001",
      "pipeline":"web-app / PR",
      "branch":"main",
      "durationSec":900,
      "queueSec":260,
      "cacheHitPct":75,
      "agentUtilPct":94,
      "status":"Passed",
      "task":"shared staging runner",
      "taskDurationSec":120,
      "taskMedianSec":120,
      "dependencyKnown":true,
      "parallelCandidate":false,
      "sequentialSec":0,
      "parallelSec":0
    }
  }'
```

The endpoint runs the same validation and deterministic analysis rules used by the dashboard and records an audit event. A future provider adapter would translate the native GitHub Actions/GitLab/Jenkins payload into this canonical contract, authenticate the sender, and optionally deliver events continuously.

## Streaming simulation protocol

The prototype does not pretend to connect directly to a production CI provider. Instead, a provider adapter or test harness sends one `build.completed`/`agent.log` event at a time to the ingress endpoint. A small batch may be sent in the `records` field. Each event is parsed, validated against the active thresholds, analysed, converted into recommendations, and recorded in the audit store. Repeating the requests models a streaming feed. The `eventId` is the delivery key: an already-accepted key returns HTTP 409, preventing duplicate recommendation/audit application. This gives the next phase a stable ingress contract for real GitHub Actions, GitLab CI or Jenkins webhook adapters.


## Native GitHub Actions simulation

A ready-to-replay fixture is included at `data/sample-github-actions-webhook.json`. With the development server running:

```bash
curl -X POST http://localhost:3000/api/integration/webhooks/github-actions \
  -H "Content-Type: application/json" \
  -H "x-event-id: gha-run-9001" \
  -H "x-ci-event: agent.log" \
  --data @data/sample-github-actions-webhook.json
```

The adapter normalizes the native-style fields, applies the active thresholds, returns bottlenecks/recommendations and appends an audit event. The same event id can be replayed safely: the second delivery is rejected as a duplicate.
