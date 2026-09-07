import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";

const demoMetrics = {
  datasetVersion: "v1.4",
  recordsAnalysed: 648,
  baselineMedianFeedback: 14.8,
  measuredMedianFeedback: 9.1,
  baselineQueue: 3.7,
  measuredQueue: 2.2,
  baselineCacheHitRate: 41,
  measuredCacheHitRate: 74,
  baselineAgentUtilisation: 91,
  measuredAgentUtilisation: 82,
  bottlenecks: 7,
  recommendations: 4,
  approved: 1,
  rollbacks: 0,
  falsePositives: 4,
  falseNegatives: 3,
};

const defaultSettings = {
  queueThreshold: 20,
  slowTaskMultiplier: 1.5,
  cacheMissRate: 40,
  agentUtilisation: 80,
  parallelisationImprovement: 15,
  highImpactSeconds: 60,
};

let auditEvents = [
  { id: "AUD-0042", action: "Approved", recommendationId: "REC-1843", user: "DevOps Admin", reason: "Validated concurrent quality gates against staging", evidenceVersion: "v1.4", configurationVersion: "v1.5" },
  { id: "AUD-0041", action: "Override", recommendationId: "REC-1844", user: "SRE Team", reason: "Risk changed from MEDIUM to HIGH", evidenceVersion: "v1.4", configurationVersion: "v1.5" },
];

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
    overview: publicProcedure.query(() => demoMetrics),
    settings: publicProcedure.query(() => defaultSettings),
    updateSettings: publicProcedure.input(z.object({
      queueThreshold: z.number().min(1).max(100),
      slowTaskMultiplier: z.number().min(1).max(3),
      cacheMissRate: z.number().min(1).max(100),
      agentUtilisation: z.number().min(1).max(100),
      parallelisationImprovement: z.number().min(1).max(100),
      highImpactSeconds: z.number().min(1).max(600),
    })).mutation(({ input }) => {
      Object.assign(defaultSettings, input);
      auditEvents = [{ id: `AUD-${String(auditEvents.length + 43).padStart(4, "0")}`, action: "Threshold updated", recommendationId: "CONFIG", user: "Demo user", reason: "Analysis sensitivity changed", evidenceVersion: "v1.4", configurationVersion: "v1.6" }, ...auditEvents];
      return { success: true, settings: defaultSettings, configurationVersion: "v1.6" };
    }),
    audit: publicProcedure.query(() => auditEvents),
    recommendationAction: publicProcedure.input(z.object({ id: z.string(), action: z.enum(["approve", "reject", "override", "apply", "rollback"]), reason: z.string().optional() })).mutation(({ input }) => {
      const label = input.action.charAt(0).toUpperCase() + input.action.slice(1);
      auditEvents = [{ id: `AUD-${String(auditEvents.length + 43).padStart(4, "0")}`, action: label, recommendationId: input.id, user: "Demo user", reason: input.reason ?? "Decision recorded", evidenceVersion: "v1.4", configurationVersion: "v1.5" }, ...auditEvents];
      return { success: true, id: input.id, action: input.action, auditId: auditEvents[0].id };
    }),
  }),
});

export type AppRouter = typeof appRouter;
