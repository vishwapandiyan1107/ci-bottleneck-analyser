# Validation Report

## Dataset description
The generated CSV contains 265 records: 255 valid records and 10 intentionally invalid records. It covers cache, queue, slow-task, agent-saturation, parallelisation, normal, missing-timestamp, negative-duration, and missing-cache/dependency scenarios.

## Labels
`QUEUE_BOTTLENECK`, `SLOW_TASK`, `CACHE_OPPORTUNITY`, `AGENT_SATURATION`, `PARALLELISATION_OPPORTUNITY`, and `NONE`.

## Thresholds
Default rules use queue share 20%, slow-task multiplier 1.5x, cache miss rate 40%, agent utilisation 80%, parallelisation improvement 15%, and high-impact saving 60 seconds. Thresholds are configurable through the existing settings procedure.

## Baseline, target, measured result
The API calculates baseline median feedback from valid duration plus queue values. The target is 70% of that baseline. The measured result applies the dataset-derived cache and parallelisation savings estimate; no fixed 14.8 or 9.1 values are used. The API also reports median feedback-time reduction percentage.

## Cache, queue, and agent results
Cache hit/miss, median queue time, and median valid agent utilisation are calculated from non-missing fields. Missing cache/dependency rows are excluded from cache detection.

## FP/FN analysis
The evaluator compares every valid record and every non-NONE label with its deterministic prediction and reports TP, TN, FP, FN, precision, recall, false-positive rate, false-negative rate, and disagreement examples with reasons.

## Edge cases
Missing timestamps and negative durations are invalid and excluded. Missing cache/dependency data remains analyzable for general metrics but cannot produce a cache recommendation.

## Tests
Automated tests cover bottleneck rules, cache, parallelisation, queue, agent utilisation, FP/FN, all three failure cases, manual override, audit fields, apply, and rollback restoration.

## Limitations
The CSV is synthetic and the experiment is an offline estimate, not a production replay. Recommendation state and audit events are process-local memory in this implementation; a database-backed deployment should persist them. The current client overview is wired to calculated API KPIs, while several legacy presentation cards and sample build rows remain static display fixtures.
