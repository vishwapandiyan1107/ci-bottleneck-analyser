import fs from "node:fs";
import path from "node:path";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  analyseBuilds,
  parseCsv,
  parseJson,
  settingsSchema,
  validateRecords,
  type AnalysisSettings,
} from "./analysisEngine";
import {
  appendAudit,
  getStore,
  saveSettings,
  setRecommendations,
  updateRecommendation,
} from "./persistence";

function loadDemoCsv() {
  const candidates = [
    path.resolve(process.cwd(), "data/ci_build_logs.csv"),
    path.resolve(process.cwd(), "data/validation-builds.csv"),
    path.resolve(process.cwd(), "../data/ci_build_logs.csv"),
    path.resolve(process.cwd(), "../data/validation-builds.csv"),
  ];
  const file = candidates.find(fs.existsSync);
  if (!file) throw new Error("Validation dataset is missing. Expected data/validation-builds.csv");
  return fs.readFileSync(file, "utf8");
}

function runAnalysis(content: string, settings: AnalysisSettings, format: "csv" | "json" = "csv") {
  const raw = format === "json" ? parseJson(content) : parseCsv(content);
  const validation = validateRecords(raw);
  const result = analyseBuilds(validation.valid, settings);
  return {
    ...result,
    validationErrors: validation.errors.length,
    errors: validation.errors.slice(0, 25),
    validRecords: validation.valid.length,
  };
}

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
      const store = getStore();
      const result = runAnalysis(loadDemoCsv(), store.settings);
      setRecommendations(result.recommendations);
      return result;
    }),

    settings: publicProcedure.query(() => {
      const store = getStore();
      return { ...store.settings, configurationVersion: `v${store.configurationVersion}` };
    }),

    updateSettings: publicProcedure
      .input(settingsSchema)
      .mutation(({ input }) => {
        const store = saveSettings(input);
        const version = `v${store.configurationVersion}`;
        appendAudit({
          action: "Threshold updated",
          recommendationId: "CONFIG",
          user: "Demo user",
          reason: "Analysis sensitivity changed",
          evidenceVersion: "v2.2",
          configurationVersion: version,
        });
        return { success: true, settings: store.settings, configurationVersion: version };
      }),

    analyseCsv: publicProcedure
      .input(z.object({ csv: z.string().min(10).max(5_000_000), format: z.enum(["csv", "json"]).default("csv"), datasetVersion: z.string().default("uploaded") }))
      .mutation(({ input }) => {
        const store = getStore();
        const result = runAnalysis(input.csv, store.settings, input.format);
        setRecommendations(result.recommendations);
        appendAudit({
          action: "Analysis completed",
          recommendationId: "ANALYSIS",
          user: "Demo user",
          reason: `${result.validRecords} valid records analysed; ${result.validationErrors} records rejected.`,
          evidenceVersion: input.datasetVersion,
          configurationVersion: `v${store.configurationVersion}`,
        });
        return result;
      }),

    demo: publicProcedure.mutation(() => {
      const store = getStore();
      const result = runAnalysis(loadDemoCsv(), store.settings);
      setRecommendations(result.recommendations);
      appendAudit({
        action: "Demo dataset analysed",
        recommendationId: "DATASET",
        user: "Demo user",
        reason: `Loaded ${result.validRecords} validated records from the reproducible validation dataset.`,
        evidenceVersion: result.datasetVersion,
        configurationVersion: `v${store.configurationVersion}`,
      });
      return result;
    }),

    audit: publicProcedure.query(() => getStore().audit),

    recommendations: publicProcedure.query(() => getStore().recommendations),

    recommendationAction: publicProcedure
      .input(z.object({
        id: z.string().min(1),
        action: z.enum(["approve", "reject", "override", "apply", "rollback"]),
        reason: z.string().trim().min(3).max(500),
      }))
      .mutation(({ input }) => {
        try {
          const updated = updateRecommendation(input.id, input.action);
          if (!updated) {
            throw new TRPCError({ code: "NOT_FOUND", message: `Recommendation ${input.id} was not found.` });
          }
          const store = getStore();
          const event = appendAudit({
            action: input.action === "rollback" ? "Rolled back" : updated.status,
            recommendationId: input.id,
            user: "Demo user",
            reason: input.reason,
            evidenceVersion: "v2.2",
            configurationVersion: `v${store.configurationVersion}`,
          });
          return {
            success: true,
            id: input.id,
            action: input.action,
            auditId: event.id,
            status: updated.status,
            previousStatus: updated.previousStatus,
          };
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Decision rejected" });
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;

