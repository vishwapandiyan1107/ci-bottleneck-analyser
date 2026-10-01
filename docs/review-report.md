# CI Bottleneck Analyser — Review Report

## Architecture
React/Vite frontend + Express/tRPC backend + Drizzle/MySQL schema. The UI covers overview, builds, bottlenecks, recommendations, experiment, audit and threshold configuration. The backend now contains a deterministic analysis engine, CSV/JSON ingestion, validation, recommendation generation and governed recommendation actions.

## Implemented flow
Build log -> validation -> bottleneck detection -> evidence -> recommendation -> human decision -> audit -> optimisation measurement.

## Core rules
- Cache opportunity: cache hit below the configured miss threshold.
- Queue bottleneck: median queue share exceeds configured threshold.
- Slow task: task duration exceeds the configured multiplier of task median.
- Agent saturation: utilisation reaches configured threshold.
- Parallelisation: dependency-safe sequential work exceeds the configured improvement threshold.

## Governance
Recommendations carry severity, confidence, risk, evidence, proposed change and rollback instructions. Override requires a reason. Actions are persisted in the local runtime store when no database is configured. Drizzle tables are also defined for build records, analysis runs, recommendations, audit events and versioned settings.

## Measurement
The experiment calculates baseline and deterministic optimised scenarios from the dataset. It reports median/P90 feedback time, queue time, cache hit rate, agent utilisation and detection quality (TP/FP/TN/FN, precision, recall and F1).

## Validation
The repository includes a 648-record reproducible synthetic dataset, sample JSON data, automated engine/API tests and explicit handling for duplicate records, invalid durations, missing telemetry and hidden dependencies.

## Integration
tRPC procedures provide analysis, upload, settings, recommendations and audit boundaries. A production adapter can map GitHub Actions, GitLab CI or Jenkins events/logs into the ingestion schema.

## Limitations
The validation dataset is synthetic and live CI-provider mutation is not implemented. The optimisation experiment is a deterministic simulation rather than a claim of production savings. Real stakeholder research and provider-specific rollback adapters are still required for production deployment.
