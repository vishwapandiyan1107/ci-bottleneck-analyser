# Limitations Report

This review-stage implementation uses a reproducible synthetic validation dataset. It does not connect to a live CI provider. The optimisation measurement is a deterministic simulation based on observed telemetry and recommendation rules, not a claim of production savings.

Database tables are defined in Drizzle for production persistence, while local development uses a JSON audit/recommendation store when DATABASE_URL is unavailable. Live rollback of GitHub/GitLab/Jenkins configuration is intentionally represented as a governed application state transition; a provider adapter would be required to mutate an external CI system.

Stakeholder ratings in the UI are prototype/simulated validation values and should be replaced by real user research before production deployment.
