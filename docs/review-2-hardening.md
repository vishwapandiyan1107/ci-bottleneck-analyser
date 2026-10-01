# Review 2 Hardening Changelog

## Completed improvements

### Empirical baseline and exact formula
- Added explicit even-sample median formula to the analysis response.
- Added machine-readable metric definition.
- Added a 15% median feedback reduction target and <=10 minute guardrail.
- Added baseline/target/measured/error-analysis fields to the experiment result.
- Added absolute target error, relative target error, time saved and target-met status.
- Updated the Experiment UI to render these calculated values.

### Automated end-to-end tests
- Added a reproducible empirical baseline test against all 648 validation records.
- Added experiment target/error assertions.
- Added provider-native GitHub Actions webhook e2e coverage.
- Retained queue/agent threshold, malformed payload, threshold mutation, audit and idempotency coverage.

### Webhook / streaming integration
- Added `/api/integration/webhooks/:provider`.
- Added provider normalization for GitHub Actions, GitLab CI, Jenkins and generic payload shapes.
- Delegated normalized events into the canonical CI event handler to avoid divergent business logic.
- Added `data/sample-github-actions-webhook.json` replay fixture.
- Documented the production boundary: authentication, signature verification, provider log retrieval and live external mutation remain future provider adapters.

### Documentation consistency
- Bumped evidence dataset/ruleset references from v2.1 to v2.2.
- Corrected the measured median queue value to 2.67 minutes throughout the reports.
- Added `docs/evaluation-readiness.md` as a reviewer-facing requirement/evidence map.
