# Validation Report

## Dataset
The validation dataset is `data/ci_build_logs.csv` (regenerated from the retained source copy `data/validation-builds.csv`) with 648 deterministic synthetic CI records covering cache, queue, slow-task, agent-saturation, parallelisation and normal cases.

## Primary metric definition
The primary metric is median developer feedback time. For this prototype, `durationSec` is defined as the end-to-end elapsed time visible to a developer from queue entry to build completion. Therefore:

`feedbackTime_i = durationSec_i`

Queue duration is a secondary metric and is not added to `durationSec` because it is already included in that interval.

For an even-sized dataset:

`median = (x(n/2) + x(n/2 + 1)) / 2`

For `n = 648`, the two central values are 701 s and 702 s, giving:

`median = (701 + 702) / 2 = 701.5 s = 11.69 min`

The same dataset gives P90 feedback of 890 s (14.83 min), median queue of 204 s (3.40 min), mean cache hit rate of 63.02%, and mean agent utilisation of 75.77%.

## Deterministic rules
- Cache opportunity: dependency-install records with cache hit below `100 - cacheMissRate`.
- Queue bottleneck: median queue share of median feedback is at least `queueThreshold`.
- Slow task: task duration is greater than `slowTaskMultiplier × taskMedianSec`.
- Agent saturation: shared staging runner utilisation is at least `agentUtilisation`.
- Parallelisation: dependency-safe candidate work has a measurable sequential-to-parallel improvement above the configured threshold.

## Measurement
The optimisation scenario applies deterministic, documented reductions only where a recommendation exists. The output reports baseline, explicit target, measured median/P90 feedback, queue time, cache hit rate and agent utilisation. The primary target is a **15% reduction in median feedback time** plus a **<=10 minute operational guardrail**.

Target and error calculations are reproducible:

- `targetSeconds = baselineMedianSeconds × 0.85`
- `measuredReductionPct = (baselineMedianSeconds - measuredMedianSeconds) / baselineMedianSeconds × 100`
- `absoluteTargetErrorPp = measuredReductionPct - 15`
- `relativeTargetErrorPct = |absoluteTargetErrorPp| / 15 × 100`

It is an experimental simulation, not a claim of production savings.

## Calculated experiment result
The default deterministic optimisation scenario calculates:

- Median feedback: 11.69 min → 9.87 min (**15.62% lower**)
- P90 feedback: 14.83 min → 13.18 min
- Median queue: 3.40 min → 2.67 min
- Mean cache hit: 63.02% → 74.65%
- Mean agent utilisation: 75.77% → 74.66%

These are reproducible calculations from `data/validation-builds.csv`, not manually entered experiment results.

## Error analysis
The validation dataset includes `expectedLabel` values for labelled records. The analyser now evaluates each record against the explicit primary rule prediction instead of using a global existence check. Binary quality metrics answer whether a record should have any bottleneck signal at all; this avoids the earlier logical error where a global bottleneck caused unrelated rows to be counted as correctly predicted.

## End-to-end integration validation
`server/integration.e2e.test.ts` sends real HTTP requests to the integration routes. It verifies agent/queue threshold triggers, proves that threshold configuration changes affect subsequent events, verifies malformed payload rejection and webhook idempotency, and exercises a GitHub Actions-style native webhook through the provider adapter into the same recommendation and audit pipeline.

## Edge cases
The parser/validator handles duplicate IDs, negative/inconsistent durations, malformed timestamps when timestamp fields are supplied, missing/unknown dependency information and insufficient parallelisation evidence.

## Limitations
The dataset is synthetic, external CI providers are not live-connected, and optimisation measurement is deterministic simulation. Provider-specific authentication, live configuration mutation and real stakeholder research remain outside prototype scope.

## Reviewer-facing API check
`GET /api/analysis` exposes the calculated analysis for the reproducible dataset using the same engine as the dashboard. `POST /api/integration/ci-events` accepts the canonical webhook schema, applies the active thresholds, records an audit event, and rejects duplicate `eventId` values for idempotency.
