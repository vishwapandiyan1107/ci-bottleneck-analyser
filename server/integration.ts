import fs from "node:fs";
import path from "node:path";
import type { Express, Request, Response } from "express";
import { z } from "zod";
import {
  analyseBuilds,
  buildRecordSchema,
  parseCsv,
  settingsSchema,
  validateRecords,
  type BuildRecord,
} from "./analysisEngine";
import {
  appendAudit,
  appendIntegrationEvent,
  getStore,
  hasIntegrationEvent,
  setRecommendations,
} from "./persistence";

const providerSchema = z.enum(["github-actions", "gitlab-ci", "jenkins", "generic"]);

const integrationEventSchema = z.object({
  provider: providerSchema,
  eventId: z.string().min(1).max(160),
  eventType: z.enum(["build.completed", "agent.log"]),
  receivedAt: z.string().datetime().optional(),
  records: z.array(buildRecordSchema).min(1).max(100).optional(),
  record: buildRecordSchema.optional(),
}).refine(value => Boolean(value.record || value.records?.length), {
  message: "Provide record or records in the canonical CI telemetry schema.",
});

const providerWebhookSchema = z.object({
  provider: providerSchema,
  eventId: z.string().min(1).max(160),
  eventType: z.enum(["build.completed", "agent.log"]),
  payload: z.record(z.string(), z.unknown()),
});

export type IntegrationEvent = z.infer<typeof integrationEventSchema>;

function firstString(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function firstBoolean(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
    }
  }
  return undefined;
}

function normaliseStatus(value: string | undefined): "Passed" | "Failed" | "Retrying" {
  const normalized = (value ?? "Passed").toLowerCase();
  if (["failed", "failure", "cancelled", "canceled", "error"].includes(normalized)) return "Failed";
  if (["retrying", "queued", "in_progress", "in-progress", "running"].includes(normalized)) return "Retrying";
  return "Passed";
}

function firstNumber(source: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  }
  return undefined;
}

/**
 * Provider adapter boundary. Native webhook payloads are intentionally mapped
 * into the same canonical telemetry contract used by POST /api/integration/ci-events.
 * This makes the streaming simulation realistic without pretending to mutate a live CI provider.
 */
export function normalizeProviderWebhook(input: z.infer<typeof providerWebhookSchema>): IntegrationEvent {
  const p = input.payload;
  const nested = (p.record && typeof p.record === "object" && p.record !== null)
    ? p.record as Record<string, unknown>
    : p;
  const canonical = nested.canonicalRecord && typeof nested.canonicalRecord === "object" && nested.canonicalRecord !== null
    ? nested.canonicalRecord as Record<string, unknown>
    : nested;

  const record = {
    buildId: firstString(canonical, "buildId", "build_id", "id", "run_id", "pipeline_id") ?? `${input.provider}-${input.eventId}`,
    pipeline: firstString(canonical, "pipeline", "workflow", "job_name", "name") ?? "unknown-pipeline",
    branch: firstString(canonical, "branch", "ref", "git_ref") ?? "unknown",
    durationSec: firstNumber(canonical, "durationSec", "duration_sec", "duration") ?? 0,
    queueSec: firstNumber(canonical, "queueSec", "queue_sec", "queue_seconds") ?? 0,
    cacheHitPct: firstNumber(canonical, "cacheHitPct", "cache_hit_pct", "cache_hit_rate") ?? 0,
    agentUtilPct: firstNumber(canonical, "agentUtilPct", "agent_util_pct", "agent_utilisation", "agent_utilization") ?? 0,
    status: normaliseStatus(firstString(canonical, "status", "conclusion")),
    task: firstString(canonical, "task", "step", "job_name") ?? "unknown-task",
    taskDurationSec: firstNumber(canonical, "taskDurationSec", "task_duration_sec", "step_duration") ?? 0,
    taskMedianSec: firstNumber(canonical, "taskMedianSec", "task_median_sec", "baseline_duration") ?? 1,
    dependencyKnown: firstBoolean(canonical, "dependencyKnown", "dependency_known") ?? true,
    parallelCandidate: firstBoolean(canonical, "parallelCandidate", "parallel_candidate") ?? false,
    sequentialSec: firstNumber(canonical, "sequentialSec", "sequential_sec", "sequential_duration") ?? 0,
    parallelSec: firstNumber(canonical, "parallelSec", "parallel_sec", "parallel_duration") ?? 0,
    expectedLabel: firstString(canonical, "expectedLabel", "ground_truth"),
    queuedAt: firstString(canonical, "queuedAt", "queued_at", "created_at"),
    startedAt: firstString(canonical, "startedAt", "started_at"),
    completedAt: firstString(canonical, "completedAt", "completed_at", "finished_at"),
    agentName: firstString(canonical, "agentName", "agent_name", "runner_name", "runner"),
  };

  const parsed = buildRecordSchema.parse(record);
  return { provider: input.provider, eventId: input.eventId, eventType: input.eventType, record: parsed };
}

function normaliseRecords(input: IntegrationEvent): BuildRecord[] {
  return input.records ?? (input.record ? [input.record] : []);
}

function sendJson(res: Response, status: number, body: unknown) {
  res.status(status).json(body);
}

function loadDemoCsv() {
  const candidates = [
    path.resolve(process.cwd(), "data/ci_build_logs.csv"),
    path.resolve(process.cwd(), "data/validation-builds.csv"),
    path.resolve(process.cwd(), "../data/ci_build_logs.csv"),
  ];
  const file = candidates.find(fs.existsSync);
  if (!file) throw new Error("Validation dataset is missing.");
  return fs.readFileSync(file, "utf8");
}

export function registerCiIntegrationRoutes(app: Express) {
  app.get("/api/analysis", (_req, res) => {
    try {
      const store = getStore();
      const parsed = parseCsv(loadDemoCsv());
      const validation = validateRecords(parsed);
      const analysis = analyseBuilds(validation.valid, settingsSchema.parse(store.settings));
      return sendJson(res, 200, {
        ok: true,
        ...analysis,
        validationErrors: validation.errors.length,
        errors: validation.errors.slice(0, 25),
      });
    } catch (error) {
      return sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : "Analysis failed" });
    }
  });

  app.get("/api/integration/health", (_req, res) => {
    sendJson(res, 200, {
      ok: true,
      service: "ci-bottleneck-analyser-integration",
      contract: "canonical-ci-telemetry-v1",
      providers: ["github-actions", "gitlab-ci", "jenkins", "generic"],
    });
  });

  app.post("/api/integration/webhooks/:provider", async (req: Request, res: Response) => {
    const parsed = providerWebhookSchema.safeParse({
      provider: req.params.provider,
      eventId: req.header("x-event-id") ?? req.body?.eventId,
      eventType: req.header("x-ci-event") ?? req.body?.eventType ?? "build.completed",
      payload: (req.body?.payload && typeof req.body.payload === "object") ? req.body.payload : req.body,
    });
    if (!parsed.success) {
      return sendJson(res, 400, { ok: false, error: "Invalid provider webhook", details: parsed.error.issues.map(issue => issue.message) });
    }
    try {
      const canonical = normalizeProviderWebhook(parsed.data);
      // Delegate to the canonical contract so provider adapters cannot diverge
      // from validation, thresholds, recommendation generation or audit rules.
      req.body = canonical;
      return handleCanonicalEvent(req, res);
    } catch (error) {
      return sendJson(res, 422, { ok: false, error: error instanceof Error ? error.message : "Provider payload could not be normalized" });
    }
  });

  async function handleCanonicalEvent(req: Request, res: Response) {
    const parsed = integrationEventSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendJson(res, 400, {
        ok: false,
        error: "Invalid integration event",
        details: parsed.error.issues.map(issue => issue.message),
      });
    }

    const input = parsed.data;
    if (hasIntegrationEvent(input.eventId)) {
      return sendJson(res, 409, {
        ok: false,
        error: "Duplicate eventId",
        eventId: input.eventId,
        message: "The event was already accepted and is intentionally idempotent.",
      });
    }

    try {
      const store = getStore();
      const records = normaliseRecords(input);
      const validation = validateRecords(records);
      if (!validation.valid.length) {
        return sendJson(res, 422, {
          ok: false,
          error: "No valid CI records in event",
          rejected: validation.errors,
        });
      }

      const analysis = analyseBuilds(validation.valid, settingsSchema.parse(store.settings));
      setRecommendations(analysis.recommendations);
      appendIntegrationEvent({
        eventId: input.eventId,
        provider: input.provider,
        eventType: input.eventType,
        acceptedRecords: validation.valid.length,
      });
      appendAudit({
        action: "CI event ingested",
        recommendationId: "INTEGRATION",
        user: `Provider: ${input.provider}`,
        reason: `${input.eventType} ${input.eventId}; ${validation.valid.length} record(s) accepted, ${validation.errors.length} rejected.`,
        evidenceVersion: analysis.datasetVersion,
        configurationVersion: `v${store.configurationVersion}`,
      });

      return sendJson(res, 200, {
        ok: true,
        eventId: input.eventId,
        provider: input.provider,
        accepted: validation.valid.length,
        rejected: validation.errors.length,
        thresholdsTriggered: analysis.bottlenecks.map(item => item.label),
        bottlenecks: analysis.bottlenecks,
        recommendations: analysis.recommendations,
        metricSnapshot: {
          medianFeedbackMinutes: analysis.baselineMedianFeedback,
          medianQueueMinutes: analysis.baselineQueue,
          cacheHitRate: analysis.baselineCacheHitRate,
          agentUtilisation: analysis.baselineAgentUtilisation,
        },
        auditRecorded: true,
        streamingNote: "Each webhook request is a discrete CI event; repeated calls simulate a streaming feed and remain idempotent by eventId.",
      });
    } catch (error) {
      return sendJson(res, 500, {
        ok: false,
        error: error instanceof Error ? error.message : "Integration event processing failed",
      });
    }
  }

  app.post("/api/integration/ci-events", handleCanonicalEvent);
}
