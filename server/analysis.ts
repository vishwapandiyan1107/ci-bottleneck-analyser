/**
 * Compatibility entry point for the review specification.
 * The implementation lives in analysisEngine.ts; this module keeps a stable
 * `server/analysis.ts` import surface for reviewers and future integrations.
 */
export * from "./analysisEngine";
