import { describe, expect, it } from "vitest";
import { analyse, evaluate, isValidLog, parseBuildLogs, type BuildLog } from "./analysis";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

const context = (): TrpcContext => ({ user: null, req: { protocol: "https", headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] });
const log = (overrides: Partial<BuildLog> = {}): BuildLog => ({ build_id: "B-1", pipeline: "web", branch: "main", task: "tests", task_start: "2026-01-01T00:00:00Z", task_end: "2026-01-01T00:01:00Z", duration_sec: 60, queue_time_sec: 10, cache_hit: true, agent_id: "runner-1", agent_utilisation: 50, dependency_group: "tests", ground_truth: "NONE", ...overrides });

describe("dataset analysis", () => {
  it("calculates metrics and detects queue, cache, agent, slow and parallel signals", () => {
    const result = analyse([log({ queue_time_sec: 100, ground_truth: "QUEUE_BOTTLENECK" }), log({ build_id: "B-2", task: "unit + analysis", duration_sec: 300, cache_hit: false, agent_utilisation: 95, dependency_group: "tests-and-analysis", ground_truth: "CACHE_OPPORTUNITY" })]);
    expect(result.recordsAnalysed).toBe(2); expect(result.queueTime).toBe(55); expect(result.cacheMissRate).toBe(50); expect(result.recommendations.map(item => item.type)).toEqual(expect.arrayContaining(["QUEUE_BOTTLENECK", "CACHE_OPPORTUNITY", "AGENT_SATURATION", "SLOW_TASK", "PARALLELISATION_OPPORTUNITY"]));
  });

  it.each([["missing timestamp", log({ task_start: "" })], ["negative duration", log({ duration_sec: -1 })], ["missing cache/dependency data", log({ cache_hit: null, dependency_group: "" })]])("rejects %s without a false cache recommendation", (_name, invalid) => {
    const result = analyse([invalid]); expect(result.recommendations).not.toContainEqual(expect.objectContaining({ affectedBuild: invalid.build_id, type: "CACHE_OPPORTUNITY" }));
    if (_name === "missing cache/dependency data") expect(result.recordsAnalysed).toBe(1); else expect(result.recordsAnalysed).toBe(0);
    expect(isValidLog(invalid)).toBe(_name === "missing cache/dependency data");
  });

  it("evaluates FP, FN, precision, recall and error rates", () => {
    const result = evaluate([log({ ground_truth: "QUEUE_BOTTLENECK", queue_time_sec: 100 }), log({ build_id: "B-2", ground_truth: "QUEUE_BOTTLENECK" }), log({ build_id: "B-3", ground_truth: "NONE", queue_time_sec: 100 })]);
    expect(result.TP).toBeGreaterThan(0); expect(result.FP + result.FN).toBeGreaterThan(0); expect(result.precision).toBeGreaterThanOrEqual(0); expect(result.falseNegativeRate).toBeGreaterThanOrEqual(0);
  });

  it("parses the required ground_truth column", () => { expect(parseBuildLogs("build_id,task_start,task_end,ground_truth\nB,2026-01-01,2026-01-01,NONE")[0]?.ground_truth).toBe("NONE"); });
});

describe("recommendation lifecycle", () => {
  it("requires override reason and records complete audit state transitions including rollback", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.analysis.recommendationAction({ id: "REC-X", action: "override", reason: "" })).rejects.toThrow();
    const override = await caller.analysis.recommendationAction({ id: "REC-X", action: "override", reason: "Resource policy changed" });
    const approved = await caller.analysis.recommendationAction({ id: "REC-APPROVE", action: "approve", reason: "Evidence reviewed" });
    const rejected = await caller.analysis.recommendationAction({ id: "REC-REJECT", action: "reject", reason: "Risk is not acceptable" });
    const applied = await caller.analysis.recommendationAction({ id: "REC-X", action: "apply", reason: "Approved after review" });
    const rollback = await caller.analysis.recommendationAction({ id: "REC-X", action: "rollback", reason: "Measured regression" });
    expect(override.previousState).toBe("Pending review"); expect(approved.newState).toBe("Approved"); expect(rejected.newState).toBe("Rejected"); expect(applied.previousState).toBe("Overridden"); expect(rollback.newState).toBe("Overridden");
    const events = await caller.analysis.audit(); expect(events[0]).toMatchObject({ action: "Rollback", previousState: "Applied", newState: "Overridden", reason: "Measured regression" });
  });

  it("serves dataset-backed overview and experiment metrics", async () => { const result = await appRouter.createCaller(context()).analysis.overview(); expect(result.recordsAnalysed).toBeGreaterThan(0); expect(result.invalidRecords).toBe(10); expect(result.experiment.reductionPercent).toBeGreaterThanOrEqual(0); expect(result.highPriorityRecommendations.every(item => item.evidence.length > 0)).toBe(true); });
});
