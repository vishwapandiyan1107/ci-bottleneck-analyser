# CI Bottleneck Analyser

## Setup

```bash
pnpm install
npx tsx server/generate_dataset.ts
pnpm test
pnpm build
pnpm dev
```

The development server prints its local URL. The dataset lives at `data/ci_build_logs.csv`.

## Architecture

The Vite React client preserves the existing dashboard, explorer, bottleneck, recommendation, experiment, audit, threshold, override, and rollback surfaces. The Express server mounts tRPC under `/api/trpc` and exposes calculated read-only analysis at `/api/analysis`. `server/analysis.ts` owns CSV parsing, validation, metrics, deterministic rules, recommendations, and FP/FN evaluation.

## Rules and dataset

The CSV has build identity, pipeline, branch, task timing, queue, cache, agent, dependency, and `ground_truth` columns. Invalid rows are excluded from recommendations. Rules detect queue share, global slow tasks, cache misses with dependency evidence, agent saturation, and independent quality gates.

## Experiment and validation

Baseline, target, measured result, and median feedback reduction are calculated from valid data. The validation report describes labels, thresholds, cache, queue, agent, FP/FN, and edge-case results.

## Audit, override, and rollback

Every recommendation action requires a reason and records the prior/new state, evidence, timestamp, and configuration version. Apply saves the prior state. Rollback restores it and writes a rollback event. See `docs/requirements.md` and `docs/validation-report.md` for the requirement mapping and validation details.
