import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { analyseBuilds, parseCsv, validateRecords, defaultAnalysisSettings } from "./analysisEngine";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

afterEach(() => {
  const store = path.resolve(process.cwd(), "server/runtime-store.json");
  if (fs.existsSync(store)) fs.rmSync(store);
});

describe("analysis engine", () => {
  it("parses and validates build-log CSV records", () => {
    const csv = [
      "buildId,pipeline,branch,durationSec,queueSec,cacheHitPct,agentUtilPct,status,task,taskDurationSec,taskMedianSec,dependencyKnown,parallelCandidate,sequentialSec,parallelSec,expectedLabel",
      "b1,web,main,600,100,20,92,Passed,dependency install,220,120,true,false,0,0,CACHE_OPPORTUNITY",
      "b2,web,main,500,90,80,70,Passed,build,180,180,true,false,0,0,NONE",
    ].join("\n");
    const raw = parseCsv(csv);
    const result = validateRecords(raw);
    expect(result.valid).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects duplicate and invalid records", () => {
    const input = [
      { buildId: "a", pipeline: "web", branch: "main", durationSec: 10, queueSec: 20, cacheHitPct: 50, agentUtilPct: 50, status: "Passed", task: "build", taskDurationSec: 5, taskMedianSec: 5, dependencyKnown: true },
      { buildId: "a", pipeline: "web", branch: "main", durationSec: 20, queueSec: 5, cacheHitPct: 50, agentUtilPct: 50, status: "Passed", task: "build", taskDurationSec: 5, taskMedianSec: 5, dependencyKnown: true },
    ];
    const result = validateRecords(input);
    expect(result.valid).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });


  it("rejects malformed timestamps when timestamp fields are supplied", () => {
    const input = [{
      buildId: "bad-ts", pipeline: "web", branch: "main", durationSec: 600, queueSec: 100,
      cacheHitPct: 80, agentUtilPct: 50, status: "Passed" as const, task: "build",
      taskDurationSec: 200, taskMedianSec: 200, dependencyKnown: true, queuedAt: "not-a-date",
    }];
    const result = validateRecords(input);
    expect(result.valid).toHaveLength(0);
    expect(result.errors[0]?.reason).toContain("Invalid timestamp");
  });

  it("detects bottlenecks and computes a measurable optimisation scenario", () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      buildId: `b${i}`,
      pipeline: "web-app",
      branch: "main",
      durationSec: 900,
      queueSec: 260,
      cacheHitPct: 20,
      agentUtilPct: 92,
      status: "Passed" as const,
      task: "dependency install",
      taskDurationSec: 260,
      taskMedianSec: 120,
      dependencyKnown: true,
      parallelCandidate: i % 2 === 0,
      sequentialSec: 380,
      parallelSec: 250,
      expectedLabel: i % 2 === 0 ? "PARALLELISATION_OPPORTUNITY" : "CACHE_OPPORTUNITY",
    }));
    const result = analyseBuilds(records, defaultAnalysisSettings);
    expect(result.recordsAnalysed).toBe(10);
    expect(result.bottlenecks.length).toBeGreaterThanOrEqual(3);
    expect(result.recommendations.length).toBe(result.bottlenecks.length);
    expect(result.measuredMedianFeedback).toBeLessThan(result.baselineMedianFeedback);
  });

  it("uses the documented median feedback formula without double-counting queue time", () => {
    const records = [
      { buildId: "m1", pipeline: "web", branch: "main", durationSec: 600, queueSec: 120, cacheHitPct: 80, agentUtilPct: 50, status: "Passed" as const, task: "build", taskDurationSec: 200, taskMedianSec: 200, dependencyKnown: true },
      { buildId: "m2", pipeline: "web", branch: "main", durationSec: 700, queueSec: 150, cacheHitPct: 80, agentUtilPct: 50, status: "Passed" as const, task: "build", taskDurationSec: 220, taskMedianSec: 220, dependencyKnown: true },
      { buildId: "m3", pipeline: "web", branch: "main", durationSec: 900, queueSec: 200, cacheHitPct: 80, agentUtilPct: 50, status: "Passed" as const, task: "build", taskDurationSec: 240, taskMedianSec: 240, dependencyKnown: true },
    ];
    const result = analyseBuilds(records, defaultAnalysisSettings);
    expect(result.baselineMedianFeedback).toBe(700 / 60);
    expect(result.formula).toContain("queueSec is not added again");
  });

});

describe("analysis API", () => {
  it("returns metrics from the reproducible 648-record dataset", async () => {
    const result = await appRouter.createCaller(createContext()).analysis.overview();
    expect(result.recordsAnalysed).toBe(648);
    expect(result.bottlenecks.length).toBeGreaterThan(0);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.measuredMedianFeedback).toBeLessThan(result.baselineMedianFeedback);
  });

  it("persists recommendation actions into the audit trail", async () => {
    const caller = appRouter.createCaller(createContext());
    const overview = await caller.analysis.overview();
    const before = await caller.analysis.audit();
    const result = await caller.analysis.recommendationAction({
      id: overview.recommendations[0].id,
      action: "override",
      reason: "Shared staging resource requires sequential execution",
    });
    const after = await caller.analysis.audit();
    expect(result.success).toBe(true);
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toMatchObject({
      action: "Overridden",
      recommendationId: overview.recommendations[0].id,
    });
  });


  it("applies then rolls back a recommendation to its prior reviewed state", async () => {
    const caller = appRouter.createCaller(createContext());
    const overview = await caller.analysis.overview();
    const id = overview.recommendations[0].id;
    await caller.analysis.recommendationAction({ id, action: "approve", reason: "Reviewed evidence and confirmed staging safety" });
    const applied = await caller.analysis.recommendationAction({ id, action: "apply", reason: "Apply approved prototype configuration" });
    expect(applied.status).toBe("Applied");
    const rolledBack = await caller.analysis.recommendationAction({ id, action: "rollback", reason: "Restore the previously approved configuration" });
    expect(rolledBack.status).toBe("Approved");
    const audit = await caller.analysis.audit();
    expect(audit[0]).toMatchObject({ action: "Rolled back", recommendationId: id });
  });

  it("validates and versions threshold configuration", async () => {
    const caller = appRouter.createCaller(createContext());
    const result = await caller.analysis.updateSettings({
      queueThreshold: 25,
      slowTaskMultiplier: 1.8,
      cacheMissRate: 45,
      agentUtilisation: 85,
      parallelisationImprovement: 20,
      highImpactSeconds: 90,
    });
    expect(result.success).toBe(true);
    expect(result.configurationVersion).toBe("v2");
    expect(result.settings.queueThreshold).toBe(25);
  });
});

describe("empirical KPI and experiment evidence", () => {
  it("exposes a reproducible median formula, target and explicit error analysis", () => {
    const csvPath = path.resolve(process.cwd(), "data/ci_build_logs.csv");
    const csv = fs.readFileSync(csvPath, "utf8");
    const records = parseCsv(csv);
    const validation = validateRecords(records);
    const result = analyseBuilds(validation.valid);

    expect(result.recordsAnalysed).toBe(648);
    expect(result.baselineMedianFeedback).toBe(11.69);
    expect(result.formula).toContain("For even n, median");
    expect(result.metricDefinition).toContain("durationSec");
    expect(result.experiment.targetReductionPct).toBe(15);
    expect(result.experiment.errorAnalysis.baselineSeconds).toBe(701.5);
    expect(result.experiment.errorAnalysis.measuredSeconds).toBeGreaterThan(0);
    expect(result.experiment.errorAnalysis.measuredReductionPct).toBeGreaterThan(15);
    expect(result.experiment.errorAnalysis.targetMet).toBe(true);
  });
});
