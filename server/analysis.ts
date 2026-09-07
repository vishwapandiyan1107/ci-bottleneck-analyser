import fs from "node:fs";
import path from "node:path";

export type GroundTruth = "QUEUE_BOTTLENECK" | "SLOW_TASK" | "CACHE_OPPORTUNITY" | "AGENT_SATURATION" | "PARALLELISATION_OPPORTUNITY" | "NONE";
export type BuildLog = {
  build_id: string; pipeline: string; branch: string; task: string;
  task_start: string; task_end: string; duration_sec: number; queue_time_sec: number;
  cache_hit: boolean | null; agent_id: string; agent_utilisation: number | null;
  dependency_group: string; ground_truth: GroundTruth;
};
export type Settings = { queueThreshold: number; slowTaskMultiplier: number; cacheMissRate: number; agentUtilisation: number; parallelisationImprovement: number; highImpactSeconds: number };

export const defaultSettings: Settings = { queueThreshold: 20, slowTaskMultiplier: 1.5, cacheMissRate: 40, agentUtilisation: 80, parallelisationImprovement: 15, highImpactSeconds: 60 };

function parseCsv(text: string): string[][] {
  return text.trim().split(/\r?\n/).map(line => { const cells: string[] = []; let cell = ""; let quoted = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"') quoted = !quoted; else if (char === "," && !quoted) { cells.push(cell); cell = ""; } else cell += char; } cells.push(cell); return cells; });
}

export function parseBuildLogs(csv: string): BuildLog[] {
  const rows = parseCsv(csv); const headers = rows.shift() ?? []; const index = Object.fromEntries(headers.map((header, i) => [header, i]));
  return rows.map(row => { const value = (key: string) => row[index[key]] ?? ""; const cache = value("cache_hit"); const truth = value("ground_truth") as GroundTruth;
    return { build_id: value("build_id"), pipeline: value("pipeline"), branch: value("branch"), task: value("task"), task_start: value("task_start"), task_end: value("task_end"), duration_sec: Number(value("duration_sec")), queue_time_sec: Number(value("queue_time_sec")), cache_hit: cache === "" ? null : cache.toLowerCase() === "true", agent_id: value("agent_id"), agent_utilisation: value("agent_utilisation") === "" ? null : Number(value("agent_utilisation")), dependency_group: value("dependency_group"), ground_truth: truth || "NONE" };
  });
}

export function isValidLog(log: BuildLog): boolean {
  const start = Date.parse(log.task_start); const end = Date.parse(log.task_end);
  return Boolean(log.build_id && Number.isFinite(start) && Number.isFinite(end) && end >= start && Number.isFinite(log.duration_sec) && log.duration_sec >= 0 && Number.isFinite(log.queue_time_sec) && log.queue_time_sec >= 0);
}

const median = (values: number[]) => { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; };
const round = (value: number) => Math.round(value * 10) / 10;
const seconds = (value: number) => `${Math.floor(value / 60)}m ${Math.round(value % 60)}s`;

export function detect(logs: BuildLog[], settings: Settings = defaultSettings) {
  const valid = logs.filter(isValidLog); const durations = valid.map(log => log.duration_sec); const globalMedian = median(durations); const taskMedians = new Map<string, number>();
  for (const task of Array.from(new Set(valid.map(log => log.task)))) taskMedians.set(task, median(valid.filter(log => log.task === task).map(log => log.duration_sec)));
  return valid.flatMap(log => { const predictions: GroundTruth[] = []; const feedback = log.duration_sec + log.queue_time_sec; const queueShare = feedback ? log.queue_time_sec / feedback * 100 : 0;
    if (queueShare >= settings.queueThreshold) predictions.push("QUEUE_BOTTLENECK");
    if (log.duration_sec > globalMedian * settings.slowTaskMultiplier && globalMedian > 0) predictions.push("SLOW_TASK");
    if (log.cache_hit === false && log.dependency_group) predictions.push("CACHE_OPPORTUNITY");
    if ((log.agent_utilisation ?? 0) >= settings.agentUtilisation) predictions.push("AGENT_SATURATION");
    if (log.dependency_group && /\+|and|tests-and-analysis/i.test(log.task) && feedback > settings.parallelisationImprovement) predictions.push("PARALLELISATION_OPPORTUNITY");
    return predictions.map(type => ({ type, log, metric: type === "QUEUE_BOTTLENECK" ? round(queueShare) : type === "SLOW_TASK" ? round(log.duration_sec) : type === "AGENT_SATURATION" ? log.agent_utilisation : type === "CACHE_OPPORTUNITY" ? 100 : round(feedback), threshold: type === "QUEUE_BOTTLENECK" ? settings.queueThreshold : type === "SLOW_TASK" ? settings.slowTaskMultiplier : type === "CACHE_OPPORTUNITY" ? settings.cacheMissRate : type === "AGENT_SATURATION" ? settings.agentUtilisation : settings.parallelisationImprovement }));
  });
}

export function evaluate(logs: BuildLog[], settings: Settings = defaultSettings) {
  const valid = logs.filter(isValidLog); const predictions = new Map(valid.map(log => [log.build_id, new Set(detect([log], settings).map(item => item.type))])); const counts = { TP: 0, TN: 0, FP: 0, FN: 0 };
  const labels: GroundTruth[] = ["QUEUE_BOTTLENECK", "SLOW_TASK", "CACHE_OPPORTUNITY", "AGENT_SATURATION", "PARALLELISATION_OPPORTUNITY"];
  for (const log of valid) for (const label of labels) { const predicted = predictions.get(log.build_id)?.has(label) ?? false; const actual = log.ground_truth === label; if (predicted && actual) counts.TP++; else if (!predicted && !actual) counts.TN++; else if (predicted) counts.FP++; else counts.FN++; }
  const precision = counts.TP / (counts.TP + counts.FP) || 0; const recall = counts.TP / (counts.TP + counts.FN) || 0;
  return { ...counts, precision: round(precision * 100), recall: round(recall * 100), falsePositiveRate: round(counts.FP / (counts.FP + counts.TN) * 100), falseNegativeRate: round(counts.FN / (counts.FN + counts.TP) * 100), examples: valid.filter(log => (predictions.get(log.build_id)?.has(log.ground_truth) ?? false) !== (log.ground_truth !== "NONE")).slice(0, 10).map(log => ({ buildId: log.build_id, groundTruth: log.ground_truth, predicted: Array.from(predictions.get(log.build_id) ?? []), reason: isValidLog(log) ? "Rule threshold disagreed with ground truth" : "Invalid row excluded" })) };
}

export function analyse(logs: BuildLog[], settings: Settings = defaultSettings) {
  const valid = logs.filter(isValidLog); const detected = detect(valid, settings); const medianFeedback = median(valid.map(log => log.duration_sec + log.queue_time_sec)); const queue = median(valid.map(log => log.queue_time_sec)); const cacheRows = valid.filter(log => log.cache_hit !== null); const cacheHitRate = cacheRows.length ? cacheRows.filter(log => log.cache_hit).length / cacheRows.length * 100 : 0; const utilisationRows = valid.filter(log => log.agent_utilisation !== null); const agentUtilisation = median(utilisationRows.map(log => log.agent_utilisation as number));
  const grouped = Array.from(new Set(detected.map(item => item.type))).map(type => { const items = detected.filter(item => item.type === type); const first = items[0]; return { id: `REC-${type.slice(0, 3)}-${first.log.build_id}`, type, title: type.replaceAll("_", " "), severity: items.length > 10 ? "HIGH" : "MEDIUM", confidence: Math.min(99, 60 + items.length), evidence: [`${items.length} affected records`, `Metric: ${first.metric}`, `Threshold: ${first.threshold}`], metricValue: first.metric, threshold: first.threshold, affectedBuild: first.log.build_id, affectedTask: first.log.task, estimatedImprovement: seconds(Math.max(1, median(items.map(item => item.log.duration_sec)) * 0.25)), timestamp: new Date().toISOString(), configVersion: "v1.0" }; });
  const baseline = medianFeedback;
  const estimatedSavings = grouped.filter(item => ["CACHE_OPPORTUNITY", "PARALLELISATION_OPPORTUNITY"].includes(item.type)).reduce((sum, item) => sum + Number(item.estimatedImprovement.split("m")[0]) * 60, 0) / Math.max(valid.length, 1);
  const measured = Math.max(baseline - estimatedSavings, baseline * 0.5);
  return { datasetVersion: "v1.0", recordsAnalysed: valid.length, invalidRecords: logs.length - valid.length, medianFeedbackTime: round(medianFeedback), queueTime: round(queue), cacheHitRate: round(cacheHitRate), cacheMissRate: round(100 - cacheHitRate), taskDuration: round(median(valid.map(log => log.duration_sec))), agentUtilisation: round(agentUtilisation), parallelisationOpportunities: detected.filter(item => item.type === "PARALLELISATION_OPPORTUNITY").length, bottlenecks: detected.length, recommendations: grouped, highPriorityRecommendations: grouped.filter(item => item.severity === "HIGH"), evaluation: evaluate(valid, settings), experiment: { baseline, target: baseline * 0.7, measured, reductionPercent: round((baseline - measured) / baseline * 100) }, validLogs: valid };
}

export function loadAnalysis(settings: Settings = defaultSettings) { const file = path.join(process.cwd(), "data", "ci_build_logs.csv"); return analyse(parseBuildLogs(fs.readFileSync(file, "utf8")), settings); }