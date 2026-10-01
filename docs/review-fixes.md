# Review 1 Follow-up: Implemented Improvements

## Reviewer feedback addressed

### 1. Empirical baseline and exact median-feedback definition
The primary KPI is defined as end-to-end developer-visible CI elapsed time from build queue entry to completion. The dataset field `durationSec` represents that full elapsed interval and already includes the queue interval.

For each valid build record `i`:

`feedbackTime_i = durationSec_i`

For `n` valid records, sort the feedback times as `x(1) <= ... <= x(n)`.

`medianFeedbackTime = x((n+1)/2)` when `n` is odd.

`medianFeedbackTime = (x(n/2) + x(n/2 + 1)) / 2` when `n` is even.

For the 648-record validation dataset:

- `n = 648`
- 324th sorted duration = `701 s`
- 325th sorted duration = `702 s`
- Empirical median feedback = `(701 + 702) / 2 = 701.5 s = 11.69 min`
- P90 feedback = `890 s = 14.83 min`
- Median queue time = `204 s = 3.40 min`
- Mean cache hit rate = `63.02%`
- Mean agent utilisation = `75.77%`

Queue time is reported as a secondary metric and is not added again to `durationSec`; this prevents double-counting.

The implementation exposes this formula in the analysis result and documents it in `docs/requirements.md` and the validation report.

### 1a. Calculated experiment result
Using the default rules on the 648-record dataset, the current deterministic optimisation scenario calculates a median feedback time of **9.87 min** from a baseline of **11.69 min**, a **15.62%** reduction. P90 feedback changes from **14.83 min** to **13.18 min**. Median queue changes from **3.40 min** to **2.67 min** after the queue/runner relief scenario. Mean cache hit rate changes from **63.02%** to **74.65%**, and mean agent utilisation changes from **75.77%** to **74.66%**.

These values are computed from the dataset by the same engine used by the API; they are not hard-coded UI claims.

### 2. Automated end-to-end pipeline tests
`server/integration.e2e.test.ts` starts a real Express application with the CI integration routes and sends HTTP webhook requests using the Node `fetch` API.

The suite verifies:

- GitHub Actions-style agent log ingestion.
- Agent saturation threshold detection.
- Queue threshold detection.
- Threshold changes affecting subsequent events.
- Duplicate webhook `eventId` rejection for idempotency.
- Audit persistence for an accepted event.

This is intentionally an end-to-end HTTP test rather than only a unit test of the analysis function.

### 3. Streaming/webhook integration stub
The application now exposes:

- `GET /api/integration/health`
- `POST /api/integration/ci-events`

The endpoint accepts canonical CI telemetry events from `github-actions`, `gitlab-ci`, `jenkins`, or `generic` providers. A request may contain one record or a small batch. Repeated webhook calls represent the next-phase streaming flow, while `eventId` provides idempotency.

Provider-specific adapters can map native webhook payloads into the canonical schema without changing the bottleneck engine. The current endpoint runs the same validation, deterministic threshold rules, recommendation generation and audit recording used by the application.

Example payload shape:

```json
{
  "provider": "github-actions",
  "eventId": "evt-agent-001",
  "eventType": "agent.log",
  "record": {
    "buildId": "build-001",
    "pipeline": "web-app / PR",
    "branch": "main",
    "durationSec": 900,
    "queueSec": 260,
    "cacheHitPct": 75,
    "agentUtilPct": 94,
    "status": "Passed",
    "task": "shared staging runner",
    "taskDurationSec": 120,
    "taskMedianSec": 120,
    "dependencyKnown": true,
    "parallelCandidate": false,
    "sequentialSec": 0,
    "parallelSec": 0
  }
}
```

## Next phase boundary
The prototype intentionally stops before mutating a real external CI provider. GitHub Actions, GitLab CI and Jenkins adapters would authenticate with the provider, map webhook/log fields into the canonical event contract, and later execute provider-specific configuration changes under the same review/audit/rollback workflow.

### 4. Reviewer-facing compatibility and calculated REST endpoint
The review package now includes `server/analysis.ts` as a stable compatibility entry point and `data/ci_build_logs.csv` as the canonical review dataset name. `GET /api/analysis` executes the same parser, validator, settings and analysis engine used by the tRPC flow, so reviewers can verify that the displayed analysis is calculated rather than a static UI payload. A deterministic `pnpm run generate:dataset` command recreates the 648-record dataset.

## Review 2 hardening — completed

### Empirical KPI hardening
The engine now exposes a machine-readable experiment object containing the baseline in seconds, explicit 15% reduction target, measured reduction, absolute target error in percentage points, relative target error, absolute time saved, and target-met boolean. The UI renders these values rather than relying on a single improvement headline.

### Provider-native webhook hardening
A provider adapter endpoint now normalizes native-style webhook payloads through the same canonical event handler. `data/sample-github-actions-webhook.json` provides a replayable fixture. The adapter supports GitHub Actions, GitLab CI, Jenkins and generic provider identifiers and documents the production boundary: sender authentication, provider log retrieval and outbound mutation remain future integrations.

### E2E hardening
The HTTP test suite now includes a native GitHub Actions-style webhook test in addition to canonical webhook ingestion, threshold mutation, malformed payload rejection, idempotency and audit checks. A separate analysis test verifies the 648-record baseline and explicit experiment target/error calculations.
