import { z } from "zod";

export const bottleneckLabels = [
  "CACHE_OPPORTUNITY",
  "QUEUE_BOTTLENECK",
  "SLOW_TASK",
  "AGENT_SATURATION",
  "PARALLELISATION_OPPORTUNITY",
] as const;

export type BottleneckLabel = (typeof bottleneckLabels)[number];

export const buildRecordSchema = z.object({
  buildId: z.string().min(1),
  pipeline: z.string().min(1),
  branch: z.string().min(1),
  durationSec: z.number().nonnegative(),
  queueSec: z.number().nonnegative(),
  cacheHitPct: z.number().min(0).max(100),
  agentUtilPct: z.number().min(0).max(100),
  status: z.enum(["Passed", "Failed", "Retrying"]),
  task: z.string().min(1),
  taskDurationSec: z.number().nonnegative(),
  taskMedianSec: z.number().positive(),
  dependencyKnown: z.boolean(),
  parallelCandidate: z.boolean().default(false),
  sequentialSec: z.number().nonnegative().default(0),
  parallelSec: z.number().nonnegative().default(0),
  expectedLabel: z.string().optional(),
  queuedAt: z.string().optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  agentName: z.string().optional(),
});

export type BuildRecord = z.infer<typeof buildRecordSchema>;

export const settingsSchema = z.object({
  queueThreshold: z.number().min(1).max(100),
  slowTaskMultiplier: z.number().min(1).max(3),
  cacheMissRate: z.number().min(1).max(100),
  agentUtilisation: z.number().min(1).max(100),
  parallelisationImprovement: z.number().min(1).max(100),
  highImpactSeconds: z.number().min(1).max(600),
});

export type AnalysisSettings = z.infer<typeof settingsSchema>;

export const defaultAnalysisSettings: AnalysisSettings = {
  queueThreshold: 20,
  slowTaskMultiplier: 1.5,
  cacheMissRate: 40,
  agentUtilisation: 80,
  parallelisationImprovement: 15,
  highImpactSeconds: 60,
};

export type Bottleneck = {
  id: string;
  label: BottleneckLabel;
  task: string;
  pipeline: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  confidence: number;
  impactSec: number;
  evidence: string[];
  action: string;
  records: number;
};

export type Recommendation = {
  id: string;
  title: string;
  type: BottleneckLabel;
  severity: Bottleneck["severity"];
  confidence: number;
  benefitSec: number;
  risk: "LOW" | "MEDIUM" | "HIGH";
  status: "Pending review" | "Approved" | "Rejected" | "Overridden" | "Applied" | "Rolled back";
  owner: string;
  reason: string;
  proposed: string;
  rollback: string;
  evidence: string[];
};

export type QualityMetrics = {
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  precision: number;
  recall: number;
  f1: number;
  sampleSize: number;
};

export type ExperimentErrorAnalysis = {
  baselineSeconds: number;
  targetSeconds: number;
  measuredSeconds: number;
  targetReductionPct: number;
  measuredReductionPct: number;
  absoluteReductionPctPoints: number;
  relativeTargetErrorPct: number;
  absoluteTimeSavedSeconds: number;
  targetMet: boolean;
  interpretation: string;
};

export type AnalysisResult = {
  recordsAnalysed: number;
  validationErrors: number;
  baselineMedianFeedback: number;
  measuredMedianFeedback: number;
  baselineP90Feedback: number;
  measuredP90Feedback: number;
  baselineQueue: number;
  measuredQueue: number;
  baselineCacheHitRate: number;
  measuredCacheHitRate: number;
  baselineAgentUtilisation: number;
  measuredAgentUtilisation: number;
  bottlenecks: Bottleneck[];
  recommendations: Recommendation[];
  quality: QualityMetrics;
  datasetVersion: string;
  formula: string;
  metricDefinition: string;
  experiment: {
    targetMedianFeedbackMinutes: number;
    targetReductionPct: number;
    targetDefinition: string;
    errorAnalysis: ExperimentErrorAnalysis;
  };
  sampleRecords: BuildRecord[];
};

/**
 * Developer feedback time is the total elapsed CI time represented by durationSec.
 * durationSec already includes the queue interval, so queueSec is reported separately
 * and MUST NOT be added a second time when calculating the primary KPI.
 */
export function feedbackTimeSeconds(record: BuildRecord): number {
  return record.durationSec;
}

export function median(values: number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function percentile(values: number[], p: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function severityFor(impactSec: number, settings: AnalysisSettings): Bottleneck["severity"] {
  if (impactSec >= settings.highImpactSeconds * 2) return "HIGH";
  if (impactSec >= settings.highImpactSeconds) return "MEDIUM";
  return "LOW";
}

function hasValidTimestamp(value: string | undefined): boolean {
  if (!value) return true;
  return Number.isFinite(Date.parse(value));
}

function normaliseTask(task: string) {
  return task.trim().toLowerCase();
}

/**
 * Returns the single primary label predicted for a record.
 * Priority is deliberately explicit so the rule system is deterministic and explainable.
 */
export function predictPrimaryLabel(record: BuildRecord, settings: AnalysisSettings): BottleneckLabel | "NONE" {
  if (
    record.parallelCandidate &&
    record.dependencyKnown &&
    record.sequentialSec > record.parallelSec &&
    record.sequentialSec > 0
  ) {
    const improvement = ((record.sequentialSec - record.parallelSec) / record.sequentialSec) * 100;
    if (improvement >= settings.parallelisationImprovement) return "PARALLELISATION_OPPORTUNITY";
  }

  if (normaliseTask(record.task) === "dependency install" && record.cacheHitPct < 100 - settings.cacheMissRate) {
    return "CACHE_OPPORTUNITY";
  }

  if (normaliseTask(record.task) === "shared staging runner" && record.agentUtilPct >= settings.agentUtilisation) {
    return "AGENT_SATURATION";
  }

  if (normaliseTask(record.task) === "runner allocation" && record.durationSec > 0) {
    const queueShare = (record.queueSec / record.durationSec) * 100;
    if (queueShare >= settings.queueThreshold) return "QUEUE_BOTTLENECK";
  }

  if (record.taskDurationSec > record.taskMedianSec * settings.slowTaskMultiplier) {
    return "SLOW_TASK";
  }

  return "NONE";
}

export function validateRecords(input: unknown[]) {
  const valid: BuildRecord[] = [];
  const errors: { index: number; reason: string }[] = [];
  const seen = new Set<string>();

  input.forEach((item, index) => {
    const parsed = buildRecordSchema.safeParse(item);
    if (!parsed.success) {
      errors.push({ index, reason: parsed.error.issues.map(i => i.message).join("; ") });
      return;
    }
    if (seen.has(parsed.data.buildId)) {
      errors.push({ index, reason: "Duplicate buildId" });
      return;
    }
    seen.add(parsed.data.buildId);
    if (parsed.data.durationSec < parsed.data.queueSec) {
      errors.push({ index, reason: "Duration cannot be less than queue time" });
      return;
    }
    if (parsed.data.completedAt && parsed.data.startedAt && Date.parse(parsed.data.completedAt) < Date.parse(parsed.data.startedAt)) {
      errors.push({ index, reason: "completedAt cannot be earlier than startedAt" });
      return;
    }
    if (parsed.data.startedAt && parsed.data.queuedAt && Date.parse(parsed.data.startedAt) < Date.parse(parsed.data.queuedAt)) {
      errors.push({ index, reason: "startedAt cannot be earlier than queuedAt" });
      return;
    }
    for (const field of [parsed.data.queuedAt, parsed.data.startedAt, parsed.data.completedAt]) {
      if (!hasValidTimestamp(field)) {
        errors.push({ index, reason: "Invalid timestamp" });
        return;
      }
    }
    valid.push(parsed.data);
  });

  return { valid, errors };
}

export function analyseBuilds(records: BuildRecord[], settings: AnalysisSettings = defaultAnalysisSettings): AnalysisResult {
  const queue = records.map(r => r.queueSec);
  const feedback = records.map(feedbackTimeSeconds);
  const cache = records.map(r => r.cacheHitPct);
  const agents = records.map(r => r.agentUtilPct);
  const medianFeedback = median(feedback);
  const medianQueue = median(queue);
  const cacheHit = cache.length ? cache.reduce((a, b) => a + b, 0) / cache.length : 0;
  const agentUtil = agents.length ? agents.reduce((a, b) => a + b, 0) / agents.length : 0;
  const queueShare = medianFeedback ? (medianQueue / medianFeedback) * 100 : 0;

  const bottlenecks: Bottleneck[] = [];

  const cacheRows = records.filter(
    r => normaliseTask(r.task) === "dependency install" && r.cacheHitPct < 100 - settings.cacheMissRate,
  );
  if (cacheRows.length) {
    const avgHit = cacheRows.reduce((a, r) => a + r.cacheHitPct, 0) / cacheRows.length;
    const medianTask = median(cacheRows.map(r => r.taskDurationSec));
    const impact = medianTask * Math.min(1, (100 - avgHit) / 100);
    bottlenecks.push({
      id: "BOT-CACHE-001",
      label: "CACHE_OPPORTUNITY",
      task: cacheRows[0].task,
      pipeline: cacheRows[0].pipeline,
      severity: severityFor(impact, settings),
      confidence: Math.min(99, Math.round(65 + Math.min(30, (cacheRows.length / Math.max(1, records.length)) * 100))),
      impactSec: round(impact),
      evidence: [
        `Average cache hit rate ${round(avgHit)}%`,
        `${cacheRows.length} dependency-install records below the ${round(100 - settings.cacheMissRate)}% hit threshold`,
        `Median dependency-install duration ${round(medianTask)}s`,
      ],
      action: "Persist dependency cache using a stable lockfile and runtime-aware cache key.",
      records: cacheRows.length,
    });
  }

  if (queueShare >= settings.queueThreshold) {
    const impact = medianQueue * 0.35;
    bottlenecks.push({
      id: "BOT-QUEUE-001",
      label: "QUEUE_BOTTLENECK",
      task: "Runner allocation",
      pipeline: records[0]?.pipeline ?? "all pipelines",
      severity: severityFor(impact, settings),
      confidence: Math.min(99, Math.round(70 + Math.min(25, queueShare - settings.queueThreshold))),
      impactSec: round(impact),
      evidence: [
        `Median queue ${round(medianQueue)}s`,
        `Queue is ${round(queueShare)}% of median feedback time`,
        `P90 queue ${round(percentile(queue, 0.9))}s`,
      ],
      action: "Increase burst capacity or reduce noisy jobs during peak staging hours.",
      records: records.length,
    });
  }

  const slowRows = records.filter(r => r.taskDurationSec > r.taskMedianSec * settings.slowTaskMultiplier);
  if (slowRows.length) {
    const impact = Math.max(0, median(slowRows.map(r => r.taskDurationSec - r.taskMedianSec)));
    bottlenecks.push({
      id: "BOT-SLOW-001",
      label: "SLOW_TASK",
      task: slowRows[0].task,
      pipeline: slowRows[0].pipeline,
      severity: severityFor(impact, settings),
      confidence: Math.min(98, Math.round(68 + Math.min(25, (slowRows.length / Math.max(1, records.length)) * 100))),
      impactSec: round(impact),
      evidence: [
        `${slowRows.length} tasks exceed ${settings.slowTaskMultiplier}× their task median`,
        `Median slow-task duration ${round(median(slowRows.map(r => r.taskDurationSec)))}s`,
        `Median task baseline ${round(median(slowRows.map(r => r.taskMedianSec)))}s`,
      ],
      action: "Split expensive checks and cache reusable compiler or analysis artefacts.",
      records: slowRows.length,
    });
  }

  const saturated = records.filter(r => normaliseTask(r.task) === "shared staging runner" && r.agentUtilPct >= settings.agentUtilisation);
  if (saturated.length) {
    const impact = Math.max(1, median(saturated.map(r => r.queueSec)) * 0.25);
    bottlenecks.push({
      id: "BOT-AGENT-001",
      label: "AGENT_SATURATION",
      task: "Shared staging runner",
      pipeline: "all pipelines",
      severity: "HIGH",
      confidence: Math.min(98, Math.round(72 + Math.min(20, (saturated.length / Math.max(1, records.length)) * 100))),
      impactSec: round(impact),
      evidence: [
        `${saturated.length} shared-runner records at or above ${settings.agentUtilisation}% utilisation`,
        `Median saturated queue ${round(median(saturated.map(r => r.queueSec)))}s`,
        `Peak shared-runner utilisation ${round(Math.max(...saturated.map(r => r.agentUtilPct)))}%`,
      ],
      action: "Reduce noisy jobs and add controlled burst capacity before increasing global concurrency.",
      records: saturated.length,
    });
  }

  const parallelRows = records.filter(
    r => r.parallelCandidate && r.dependencyKnown && r.sequentialSec > r.parallelSec && r.sequentialSec > 0,
  );
  if (parallelRows.length) {
    const sequential = median(parallelRows.map(r => r.sequentialSec));
    const parallel = median(parallelRows.map(r => r.parallelSec));
    const saving = Math.max(0, sequential - parallel);
    const improvement = sequential ? (saving / sequential) * 100 : 0;
    if (improvement >= settings.parallelisationImprovement) {
      bottlenecks.push({
        id: "BOT-PARALLEL-001",
        label: "PARALLELISATION_OPPORTUNITY",
        task: `${parallelRows[0].task} quality gates`,
        pipeline: parallelRows[0].pipeline,
        severity: severityFor(saving, settings),
        confidence: Math.min(97, Math.round(72 + Math.min(20, improvement / 2))),
        impactSec: round(saving),
        evidence: [
          `Sequential estimate ${round(sequential)}s`,
          `Parallel estimate ${round(parallel)}s`,
          `Estimated improvement ${round(improvement)}%`,
          `${parallelRows.length} dependency-safe records`,
        ],
        action: "Run independent quality gates concurrently after the shared build artefact is created.",
        records: parallelRows.length,
      });
    }
  }

  const recommendations = makeRecommendations(bottlenecks);
  const measured = simulateOptimisation(records, recommendations);
  const measuredFeedback = median(measured.feedback);
  const measuredQueue = median(measured.queue);
  const measuredCache = measured.cache.reduce((a, b) => a + b, 0) / Math.max(1, measured.cache.length);
  const measuredAgent = measured.agent.reduce((a, b) => a + b, 0) / Math.max(1, measured.agent.length);

  // The experiment target is explicit and independently testable: reduce median
  // developer feedback time by at least 15% from the empirical baseline. The
  // absolute target is also exposed as a 10-minute operational guardrail.
  const targetReductionPct = 15;
  const targetMedianSeconds = medianFeedback * (1 - targetReductionPct / 100);
  const measuredReductionPct = medianFeedback ? ((medianFeedback - measuredFeedback) / medianFeedback) * 100 : 0;
  const relativeTargetErrorPct = targetReductionPct ? Math.abs(measuredReductionPct - targetReductionPct) / targetReductionPct * 100 : 0;
  const errorAnalysis: ExperimentErrorAnalysis = {
    baselineSeconds: round(medianFeedback, 2),
    targetSeconds: round(targetMedianSeconds, 2),
    measuredSeconds: round(measuredFeedback, 2),
    targetReductionPct,
    measuredReductionPct: round(measuredReductionPct, 2),
    absoluteReductionPctPoints: round(measuredReductionPct - targetReductionPct, 2),
    relativeTargetErrorPct: round(relativeTargetErrorPct, 2),
    absoluteTimeSavedSeconds: round(Math.max(0, medianFeedback - measuredFeedback), 2),
    targetMet: measuredReductionPct >= targetReductionPct,
    interpretation: measuredReductionPct >= targetReductionPct
      ? `Measured reduction is ${round(measuredReductionPct, 2)}%, exceeding the ${targetReductionPct}% target by ${round(measuredReductionPct - targetReductionPct, 2)} percentage points.`
      : `Measured reduction is ${round(measuredReductionPct, 2)}%, below the ${targetReductionPct}% target by ${round(targetReductionPct - measuredReductionPct, 2)} percentage points.`,
  };

  return {
    recordsAnalysed: records.length,
    validationErrors: 0,
    baselineMedianFeedback: round(medianFeedback / 60, 2),
    measuredMedianFeedback: round(measuredFeedback / 60, 2),
    baselineP90Feedback: round(percentile(feedback, 0.9) / 60, 2),
    measuredP90Feedback: round(percentile(measured.feedback, 0.9) / 60, 2),
    baselineQueue: round(medianQueue / 60, 2),
    measuredQueue: round(measuredQueue / 60, 2),
    baselineCacheHitRate: round(cacheHit),
    measuredCacheHitRate: round(measuredCache),
    baselineAgentUtilisation: round(agentUtil),
    measuredAgentUtilisation: round(measuredAgent),
    bottlenecks,
    recommendations,
    quality: calculateQuality(records, settings),
    datasetVersion: "v2.2",
    formula: "feedbackTime_i = durationSec_i; medianFeedback = median(feedbackTime_1...feedbackTime_n). For even n, median = (x[n/2] + x[n/2 + 1]) / 2. durationSec already includes queue time, so queueSec is not added again.",
    metricDefinition: "Developer feedback time is the elapsed interval from CI queue entry to build completion represented by durationSec. QueueSec is a secondary diagnostic metric and must not be added to durationSec.",
    experiment: {
      targetMedianFeedbackMinutes: round(targetMedianSeconds / 60, 2),
      targetReductionPct,
      targetDefinition: `Reduce median developer feedback time by at least ${targetReductionPct}% from the empirical baseline; the operational guardrail is <= 10 minutes.`,
      errorAnalysis,
    },
    sampleRecords: records.slice(0, 50),
  };
}

function makeRecommendations(bottlenecks: Bottleneck[]): Recommendation[] {
  const titles: Record<BottleneckLabel, string> = {
    CACHE_OPPORTUNITY: "Enable dependency cache",
    QUEUE_BOTTLENECK: "Relieve runner queue pressure",
    SLOW_TASK: "Optimise slow task",
    AGENT_SATURATION: "Relieve runner saturation",
    PARALLELISATION_OPPORTUNITY: "Parallelise quality gates",
  };

  return bottlenecks.map((b, index) => {
    const risk: Recommendation["risk"] =
      b.label === "AGENT_SATURATION" ? "HIGH" :
      b.label === "PARALLELISATION_OPPORTUNITY" ? "MEDIUM" : "LOW";
    return {
      id: `REC-${String(2000 + index).padStart(4, "0")}`,
      title: titles[b.label],
      type: b.label,
      severity: b.severity,
      confidence: b.confidence,
      benefitSec: b.impactSec,
      risk,
      status: "Pending review",
      owner: risk === "HIGH" ? "SRE" : "Platform",
      reason: b.evidence.join(". ") + ".",
      proposed: b.action,
      rollback: risk === "HIGH"
        ? "Restore the previous runner/concurrency configuration and re-run the validation dataset."
        : "Revert the changed CI step and restore the previous cache or execution configuration.",
      evidence: b.evidence,
    };
  });
}

function simulateOptimisation(records: BuildRecord[], recommendations: Recommendation[]) {
  const types = new Set(recommendations.map(r => r.type));
  return {
    feedback: records.map(r => {
      let value = r.durationSec;
      if (types.has("CACHE_OPPORTUNITY") && r.cacheHitPct < 60 && normaliseTask(r.task) === "dependency install") {
        value -= r.taskDurationSec * 0.45;
      }
      if (types.has("QUEUE_BOTTLENECK")) value -= r.queueSec * 0.3;
      if (types.has("PARALLELISATION_OPPORTUNITY") && r.parallelCandidate) {
        value -= Math.max(0, r.sequentialSec - r.parallelSec);
      }
      return Math.max(r.queueSec + 1, value);
    }),
    queue: records.map(r => {
      let value = r.queueSec;
      if (types.has("QUEUE_BOTTLENECK")) value *= 0.82;
      if (types.has("AGENT_SATURATION") && normaliseTask(r.task) === "shared staging runner") value *= 0.78;
      return Math.max(0, value);
    }),
    cache: records.map(r =>
      types.has("CACHE_OPPORTUNITY") && normaliseTask(r.task) === "dependency install"
        ? Math.min(99, Math.max(r.cacheHitPct, 74))
        : r.cacheHitPct,
    ),
    agent: records.map(r =>
      types.has("AGENT_SATURATION") && normaliseTask(r.task) === "shared staging runner"
        ? Math.max(55, r.agentUtilPct - 8)
        : r.agentUtilPct,
    ),
  };
}

/**
 * Overall detection quality is binary: did the analyser correctly identify that a
 * record contains at least one bottleneck? This avoids the previous bug where
 * every record inherited the existence of a global bottleneck of the same label.
 */
export function calculateQuality(records: BuildRecord[], settings: AnalysisSettings = defaultAnalysisSettings): QualityMetrics {
  const labelled = records.filter(r => r.expectedLabel !== undefined);
  if (!labelled.length) return { tp: 0, fp: 0, tn: 0, fn: 0, precision: 0, recall: 0, f1: 0, sampleSize: 0 };

  let tp = 0, fp = 0, tn = 0, fn = 0;
  for (const row of labelled) {
    const actualPositive = row.expectedLabel !== "NONE";
    const predictedPositive = predictPrimaryLabel(row, settings) !== "NONE";
    if (actualPositive && predictedPositive) tp++;
    else if (!actualPositive && predictedPositive) fp++;
    else if (!actualPositive && !predictedPositive) tn++;
    else fn++;
  }

  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return {
    tp,
    fp,
    tn,
    fn,
    precision: round(precision * 100),
    recall: round(recall * 100),
    f1: round(f1, 3),
    sampleSize: labelled.length,
  };
}

export function parseJson(input: string): unknown[] {
  const parsed = JSON.parse(input);
  if (!Array.isArray(parsed)) throw new Error("JSON dataset must contain an array of build records.");
  return parsed;
}

export function parseCsv(csv: string): unknown[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]).map(v => v.trim());
  return lines.slice(1).map(line => {
    const values = splitCsvLine(line);
    const raw: Record<string, string> = {};
    headers.forEach((h, i) => raw[h] = values[i] ?? "");
    const get = (...keys: string[]) => keys.map(key => raw[key]).find(value => value !== undefined) ?? "";
    const optional = (...keys: string[]) => get(...keys) || undefined;
    return {
      buildId: get("buildId", "build_id"),
      pipeline: get("pipeline"),
      branch: get("branch"),
      durationSec: Number(get("durationSec", "duration_sec")),
      queueSec: Number(get("queueSec", "queue_time_sec", "queueSec")),
      cacheHitPct: Number(get("cacheHitPct", "cache_hit_pct")),
      agentUtilPct: Number(get("agentUtilPct", "agent_utilisation", "agent_util_pct")),
      status: get("status"),
      task: get("task"),
      taskDurationSec: Number(get("taskDurationSec", "task_duration_sec")),
      taskMedianSec: Number(get("taskMedianSec", "task_median_sec")),
      dependencyKnown: String(get("dependencyKnown", "dependency_known")).trim().toLowerCase() !== "false",
      parallelCandidate: String(get("parallelCandidate", "parallel_candidate")).trim().toLowerCase() === "true",
      sequentialSec: Number(get("sequentialSec", "sequential_sec") || 0),
      parallelSec: Number(get("parallelSec", "parallel_sec") || 0),
      expectedLabel: optional("expectedLabel", "ground_truth"),
      queuedAt: optional("queuedAt", "queued_at"),
      startedAt: optional("startedAt", "task_start", "started_at"),
      completedAt: optional("completedAt", "task_end", "completed_at"),
      agentName: optional("agentName", "agent_id"),
    };
  });
}

function splitCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (ch === "," && !quoted) { values.push(current); current = ""; continue; }
    current += ch;
  }
  values.push(current);
  return values;
}
