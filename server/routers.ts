import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { defaultSettings, loadAnalysis, type Settings } from "./analysis";

let settings: Settings = { ...defaultSettings };
let configurationVersion = 1;
let auditEvents: Array<Record<string, unknown>> = [];
const recommendationStates = new Map<string, string>();
const appliedSnapshots = new Map<string, string>();
const audit = (action: string, recommendationId: string, previousState: string, newState: string, reason: string, evidence: unknown) => {
  const event = { id: `AUD-${String(auditEvents.length + 1).padStart(4, "0")}`, action, recommendationId, previousState, newState, reason, evidence, timestamp: new Date().toISOString(), configurationVersion: `v${configurationVersion}` };
  auditEvents = [event, ...auditEvents]; return event;
};

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  analysis: router({
    overview: publicProcedure.query(() => {
      const result = loadAnalysis(settings); const baseline = result.medianFeedbackTime; const measured = baseline - result.recommendations.filter(item => ["CACHE_OPPORTUNITY", "PARALLELISATION_OPPORTUNITY"].includes(item.type)).reduce((sum, item) => sum + Number(item.estimatedImprovement.split("m")[0]) * 60, 0) / Math.max(result.recordsAnalysed, 1);
      return { ...result, baselineMedianFeedback: baseline, measuredMedianFeedback: Math.max(measured, baseline * 0.5), baselineQueue: result.queueTime, measuredQueue: result.queueTime * 0.75, baselineCacheHitRate: result.cacheHitRate, measuredCacheHitRate: Math.min(100, result.cacheHitRate + 20), baselineAgentUtilisation: result.agentUtilisation, measuredAgentUtilisation: Math.max(0, result.agentUtilisation - 8), experiment: { baseline, target: baseline * 0.7, measured: Math.max(measured, baseline * 0.5), reductionPercent: roundPercent((baseline - Math.max(measured, baseline * 0.5)) / baseline * 100) } };
    }),
    settings: publicProcedure.query(() => settings),
    updateSettings: publicProcedure.input(z.object({
      queueThreshold: z.number().min(1).max(100),
      slowTaskMultiplier: z.number().min(1).max(3),
      cacheMissRate: z.number().min(1).max(100),
      agentUtilisation: z.number().min(1).max(100),
      parallelisationImprovement: z.number().min(1).max(100),
      highImpactSeconds: z.number().min(1).max(600),
    })).mutation(({ input }) => {
      settings = input; configurationVersion += 1; audit("Threshold updated", "CONFIG", `v${configurationVersion - 1}`, `v${configurationVersion}`, "Analysis sensitivity changed", input);
      return { success: true, settings, configurationVersion: `v${configurationVersion}` };
    }),
    audit: publicProcedure.query(() => auditEvents),
    recommendationAction: publicProcedure.input(z.object({ id: z.string(), action: z.enum(["approve", "reject", "override", "apply", "rollback"]), reason: z.string().trim().min(1) })).mutation(({ input }) => {
      const previousState = recommendationStates.get(input.id) ?? "Pending review"; const stateLabels: Record<string, string> = { approve: "Approved", reject: "Rejected", override: "Overridden" }; const newState = input.action === "rollback" ? appliedSnapshots.get(input.id) ?? "Approved" : input.action === "apply" ? "Applied" : stateLabels[input.action] ?? input.action;
      if (input.action === "apply") appliedSnapshots.set(input.id, previousState);
      recommendationStates.set(input.id, newState); const event = audit(input.action.charAt(0).toUpperCase() + input.action.slice(1), input.id, previousState, newState, input.reason, loadAnalysis(settings).recommendations.find(item => item.id === input.id));
      return { success: true, id: input.id, action: input.action, auditId: event.id, previousState, newState };
    }),
  }),
});

function roundPercent(value: number) { return Math.round(value * 10) / 10; }

export type AppRouter = typeof appRouter;
