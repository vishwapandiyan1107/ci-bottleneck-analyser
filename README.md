# CI Bottleneck Analyser

An end-to-end field-ready prototype for identifying CI bottlenecks in an overloaded shared staging environment and producing evidence-backed cache, queue, runner and parallelisation recommendations.

## Review-stage setup

```bash
pnpm install
pnpm run generate:dataset
pnpm run test
pnpm run test:e2e
pnpm run check
pnpm run build
pnpm run dev
```

Open `http://localhost:3000`. The reproducible validation dataset is `data/ci_build_logs.csv` (648 records); `data/validation-builds.csv` is retained as the source copy.

## Architecture

The Vite React client provides the overview, build explorer, bottleneck analysis, recommendation review, experiment, audit, threshold, override and rollback surfaces. The Express server mounts tRPC under `/api/trpc` and also exposes a calculated read-only analysis endpoint at `GET /api/analysis`. `server/analysisEngine.ts` owns CSV/JSON parsing, validation, deterministic bottleneck rules, recommendations, optimisation measurement and FP/FN evaluation; `server/analysis.ts` is a compatibility entry point for this engine.

## Empirical baseline

For the 648-record validation dataset:

- Median feedback time: **11.69 min**
- P90 feedback time: **14.83 min**
- Median queue time: **3.40 min**
- Mean cache hit rate: **63.02%**
- Mean agent utilisation: **75.77%**

Primary KPI definition: `feedbackTime_i = durationSec_i`, where `durationSec` is the end-to-end queue-to-completion interval already visible to the developer. Queue time is a secondary metric and is not added a second time. For 648 records, the two central sorted values are 701s and 702s, giving `(701+702)/2 = 701.5s = 11.69min`.

Default deterministic experiment result: median feedback **11.69 → 9.87 min (15.62% lower)**, P90 **14.83 → 13.18 min**, median queue **3.40 → 2.67 min**, mean cache hit **63.02 → 74.65%**, and mean agent utilisation **75.77 → 74.66%**. Target = **>=15% median reduction** with a **<=10 min** guardrail. The engine also reports target error and whether the target was met. These are reproducible calculations from the dataset.

## End-to-end analysis flow

1. Upload CSV or JSON telemetry from Build Explorer, or load the reproducible dataset.
2. Backend parses and validates records; duplicates, negative/inconsistent durations and malformed supplied timestamps are rejected.
3. Deterministic rules generate labelled bottlenecks with confidence, severity and evidence.
4. Recommendations add proposed changes, risk and rollback instructions.
5. Reviewers approve, reject or override; every action requires a reason.
6. Apply stores the previous recommendation state; rollback restores that state and records a rollback audit event.
7. Experiment metrics are calculated from the current validated records rather than hard-coded dashboard values.

## Integration stub

Provider-neutral REST endpoints:

- `GET /api/analysis` — calculated analysis for the reproducible dataset.
- `GET /api/integration/health` — integration contract and supported providers.
- `POST /api/integration/ci-events` — canonical CI event/webhook ingress.
- `POST /api/integration/webhooks/:provider` — native provider payload simulation and normalization for GitHub Actions, GitLab CI, Jenkins and generic CI.

Supported provider labels are GitHub Actions, GitLab CI, Jenkins and generic CI. A request may carry one record or a small batch; repeated requests represent the next-phase streaming flow. `eventId` provides idempotency so duplicate delivery returns HTTP 409 instead of re-applying the event.

## Validation and tests

The automated e2e suite starts a real Express server and sends HTTP requests to simulate agent-log/build events. It verifies agent/queue threshold triggers, threshold updates affecting later events, audit recording and duplicate-event handling.

Run:

```bash
pnpm run test
pnpm run test:e2e
pnpm run check
pnpm run build
```

## Documentation

- `docs/requirements.md` — requirement mapping and KPI definitions
- `docs/validation-report.md` — empirical baseline, rules, experiment and error analysis
- `docs/review-fixes.md` — explicit response to Review 1 feedback
- `docs/integration.md` — webhook schema and provider mapping
- `docs/limitations.md` — prototype boundary and production limitations

## Scope

This is a field-ready prototype, not a live CI-control plane. Provider-specific authentication and real external CI configuration mutation remain outside the prototype boundary.
