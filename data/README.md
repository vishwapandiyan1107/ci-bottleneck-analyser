# Validation dataset

`ci_build_logs.csv` contains 648 deterministic synthetic CI records.

Columns:
- buildId
- pipeline
- branch
- durationSec
- queueSec
- cacheHitPct
- agentUtilPct
- status
- task
- taskDurationSec
- taskMedianSec
- dependencyKnown
- parallelCandidate
- sequentialSec
- parallelSec
- expectedLabel
- optional queuedAt / startedAt / completedAt / agentName for webhook integrations

`durationSec` is defined as end-to-end build elapsed time from queue entry to completion. The primary KPI uses this field directly; queue time is reported separately to avoid double counting.

The dataset intentionally contains cache, queue, slow-task, agent-saturation, parallelisation and normal records. It is used by the API demo analysis and automated tests.

Empirical baseline for the current v2.2 dataset: 701.5s (11.69min) median feedback time; the even-sample central values are 701s and 702s. The deterministic experiment targets >=15% median reduction and reports explicit target/error calculations.
