# Evaluation Readiness — Review 2 Completion

This document maps the review improvement areas to concrete implementation evidence.

## 1. Empirical baseline + exact formula — completed

Canonical dataset: `data/ci_build_logs.csv` with 648 valid records.

- 324th sorted duration = 701s
- 325th sorted duration = 702s
- Median = `(701 + 702) / 2 = 701.5s = 11.69min`
- P90 = 14.83min
- Median queue = 3.40min
- Mean cache hit = 63.02%
- Mean agent utilisation = 75.77%

The implementation exposes the formula, metric definition, target, measured result and error analysis through `GET /api/analysis` and `analysis.overview`.

### Experiment definition

- Target reduction: >= 15% median feedback time.
- Operational guardrail: <= 10min median feedback.
- Target formula: `baseline × 0.85`.
- Reduction formula: `(baseline - measured) / baseline × 100`.
- Absolute target error: `measured reduction - 15 percentage points`.
- Relative target error: `abs(absolute target error) / 15 × 100`.

The default deterministic experiment measures approximately 15.62% median reduction, so the target is met by approximately 0.62 percentage points. The result is explicitly described as a deterministic simulation, not production savings.

## 2. Automated end-to-end pipeline tests — completed

`server/integration.e2e.test.ts` uses a real Express server and Node `fetch`.

Coverage includes:

1. GitHub Actions-style agent log ingestion.
2. Queue and agent saturation threshold triggers.
3. Threshold configuration changes affecting subsequent events.
4. Calculated `/api/analysis` endpoint.
5. Malformed event rejection.
6. Duplicate webhook idempotency.
7. Native GitHub Actions webhook normalization through `/api/integration/webhooks/github-actions`.
8. Audit recording after successful ingestion.

`server/analysis.test.ts` additionally verifies the 648-record empirical baseline, even-sample median formula, explicit 15% target and target/error calculations.

## 3. Realistic webhook / streaming integration — completed as a prototype boundary

The integration has two layers:

`native provider payload -> provider adapter -> canonical CI event -> validation -> deterministic analysis -> recommendation -> audit`

Endpoints:

- `GET /api/integration/health`
- `POST /api/integration/webhooks/:provider`
- `POST /api/integration/ci-events`

Provider IDs: `github-actions`, `gitlab-ci`, `jenkins`, `generic`.

Repeated requests model a streaming feed; `eventId` provides idempotency. Native fields such as GitHub `run_id`, `ref`, `conclusion`, queue duration, cache hit and runner utilization are mapped to the canonical schema.

The prototype does not claim live external CI control. Production integration would add sender authentication/signature validation, provider log retrieval, rate limiting and outbound provider clients for reviewed configuration changes.

## 4. Governance evidence

Recommendations support approve/reject/override/apply/rollback. High-impact recommendations carry risk and rollback instructions. Human decisions require a reason and are recorded with evidence and configuration versions.

## 5. Reproducibility commands

```bash
pnpm run generate:dataset
pnpm run test
pnpm run test:e2e
pnpm run check
pnpm run build
```

The project intentionally labels synthetic data, deterministic simulation and provider stubs as prototype limitations rather than presenting them as production measurements.
