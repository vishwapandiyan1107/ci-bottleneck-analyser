import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("analysis procedures", () => {
  it("returns baseline and measured metrics from the demo dataset", async () => {
    const result = await appRouter.createCaller(createContext()).analysis.overview();

    expect(result.recordsAnalysed).toBe(648);
    expect(result.baselineMedianFeedback).toBeGreaterThan(result.measuredMedianFeedback);
    expect(result.measuredCacheHitRate).toBeGreaterThan(result.baselineCacheHitRate);
    expect(result.measuredAgentUtilisation).toBeLessThan(result.baselineAgentUtilisation);
  });

  it("records recommendation actions in the audit trail", async () => {
    const caller = appRouter.createCaller(createContext());
    const before = await caller.analysis.audit();
    const result = await caller.analysis.recommendationAction({
      id: "REC-TEST",
      action: "override",
      reason: "Shared staging resource requires sequential execution",
    });
    const after = await caller.analysis.audit();

    expect(result.success).toBe(true);
    expect(after).toHaveLength(before.length + 1);
    expect(after[0]).toMatchObject({
      action: "Override",
      recommendationId: "REC-TEST",
      reason: "Shared staging resource requires sequential execution",
    });
  });

  it("updates thresholds with validation and returns a new configuration version", async () => {
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
    expect(result.configurationVersion).toBe("v1.6");
    expect(result.settings.queueThreshold).toBe(25);
    expect(result.settings.slowTaskMultiplier).toBe(1.8);
  });
});
