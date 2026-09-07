# CI Bottleneck Analyser Requirements

## Dataset
`data/ci_build_logs.csv` is the reproducible validation input. It contains the required build, timing, cache, agent, dependency, and `ground_truth` fields. Invalid timestamp and duration rows are retained for validation but excluded from analysis.

## Analysis
`server/analysis.ts` parses and validates the CSV, calculates median feedback and queue time, cache hit/miss rate, task duration, agent utilisation, and parallelisation opportunities. Deterministic rules detect queue bottlenecks, slow tasks, cache opportunities, agent saturation, and parallelisation opportunities.

## Recommendations
Recommendations are generated from detected records. They include evidence, metric value, threshold, affected build/task, estimated improvement, confidence, timestamp, and configuration version. No production result depends on demo metrics.

## Experiment and evaluation
The overview and experiment inputs are calculated from valid records. The experiment reports baseline, target, measured result, and median feedback-time reduction. `ground_truth` is evaluated as TP, TN, FP, FN, precision, recall, false-positive rate, and false-negative rate, with examples and reasons.

## Data quality
Rows with missing timestamps or negative durations are rejected. Missing cache/dependency fields cannot create a cache recommendation. These behaviors are covered by automated tests.

## Workflow and audit
Recommendation actions require a reason. Approve, reject, override, apply, and rollback transitions store action, recommendation ID, previous state, new state, reason, evidence, timestamp, and configuration version. Apply stores the previous state; rollback restores it and emits a rollback event.

## UI/API
The existing UI is preserved. `/api/analysis` and the existing tRPC analysis procedures expose calculated results and workflow actions.
