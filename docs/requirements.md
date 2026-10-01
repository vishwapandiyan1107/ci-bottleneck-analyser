# Requirements Specification

## Goal
Reduce median developer feedback time in an overloaded shared staging environment by identifying CI bottlenecks and providing evidence-backed cache and parallelisation recommendations.

## Inputs
- Build duration (`durationSec`)
- Queue duration (`queueSec`)
- Task duration and task median
- Cache hit rate
- Agent utilisation
- Dependency/parallelisation metadata
- Build status
- Optional queue/start/completion timestamps

## Primary metric definition
For each valid record `i`, developer feedback time is the end-to-end elapsed CI duration represented by `durationSec`:

`feedbackTime_i = durationSec_i`

`medianFeedback = median(feedbackTime_1 ... feedbackTime_n)`

`queueSec` is reported separately and is not added again because it is already included in `durationSec`.

For an even-sized dataset, if the sorted feedback values are `x(1) <= ... <= x(n)`, then:

`medianFeedback = (x(n/2) + x(n/2 + 1)) / 2`

For the canonical 648-record dataset, the central values are `701s` and `702s`, so the empirical baseline is `(701 + 702) / 2 = 701.5s = 11.69min`.

## Experiment target and error analysis

The experiment has an explicit target: **at least 15% reduction in median developer feedback time**, with an operational guardrail of **10 minutes or less**.

`targetSeconds = baselineMedianSeconds × (1 - 0.15)`

`measuredReductionPct = ((baselineMedianSeconds - measuredMedianSeconds) / baselineMedianSeconds) × 100`

`absoluteTargetErrorPp = measuredReductionPct - 15`

`relativeTargetErrorPct = |absoluteTargetErrorPp| / 15 × 100`

The dashboard and API expose baseline, target, measured result, absolute percentage-point error, relative target error, absolute time saved and whether the target was met. This prevents a percentage improvement from being presented without a reproducible baseline or error definition.

## Automated verification

The verification suite contains unit tests for the deterministic rules and a real HTTP end-to-end suite for the integration boundary. The e2e matrix covers: agent-log ingestion, queue and agent threshold triggers, threshold changes affecting later events, malformed payload rejection, webhook idempotency, provider-native GitHub Actions normalization, audit recording and the calculated reviewer-facing analysis endpoint.

## Outputs
- Labelled bottlenecks
- Confidence and severity
- Evidence
- Recommendations
- Expected benefit
- Risk
- Proposed change
- Rollback path
- Audit event
- Experiment baseline/target/measured metrics

## Governance
High-impact changes require human approval. Overrides require a reason. Apply and rollback use an explicit state machine and every action is recorded with evidence/configuration versions.

## Secondary metrics
P90 feedback time, queue time, cache hit rate, agent utilisation, precision, recall and F1.

## Edge cases
Missing telemetry, duplicate records, invalid durations, malformed/inconsistent timestamps, hidden dependencies and agent saturation are explicitly handled.
