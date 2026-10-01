import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;


export const buildRecords = mysqlTable("build_records", {
  id: int("id").autoincrement().primaryKey(),
  buildId: varchar("buildId", { length: 128 }).notNull().unique(),
  pipeline: varchar("pipeline", { length: 255 }).notNull(),
  branch: varchar("branch", { length: 255 }).notNull(),
  durationSec: decimal("durationSec", { precision: 10, scale: 2 }).notNull(),
  queueSec: decimal("queueSec", { precision: 10, scale: 2 }).notNull(),
  cacheHitPct: decimal("cacheHitPct", { precision: 5, scale: 2 }).notNull(),
  agentUtilPct: decimal("agentUtilPct", { precision: 5, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["Passed", "Failed", "Retrying"]).notNull(),
  task: varchar("task", { length: 255 }).notNull(),
  taskDurationSec: decimal("taskDurationSec", { precision: 10, scale: 2 }).notNull(),
  taskMedianSec: decimal("taskMedianSec", { precision: 10, scale: 2 }).notNull(),
  dependencyKnown: int("dependencyKnown").notNull().default(1),
  parallelCandidate: int("parallelCandidate").notNull().default(0),
  sequentialSec: decimal("sequentialSec", { precision: 10, scale: 2 }).notNull().default("0"),
  parallelSec: decimal("parallelSec", { precision: 10, scale: 2 }).notNull().default("0"),
  expectedLabel: varchar("expectedLabel", { length: 64 }),
  datasetVersion: varchar("datasetVersion", { length: 32 }).notNull().default("v2.0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const analysisRuns = mysqlTable("analysis_runs", {
  id: int("id").autoincrement().primaryKey(),
  datasetVersion: varchar("datasetVersion", { length: 32 }).notNull(),
  recordsAnalysed: int("recordsAnalysed").notNull(),
  baselineMedianFeedback: decimal("baselineMedianFeedback", { precision: 10, scale: 2 }).notNull(),
  measuredMedianFeedback: decimal("measuredMedianFeedback", { precision: 10, scale: 2 }).notNull(),
  bottleneckCount: int("bottleneckCount").notNull(),
  recommendationCount: int("recommendationCount").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const recommendations = mysqlTable("recommendations", {
  id: varchar("id", { length: 32 }).primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  type: varchar("type", { length: 64 }).notNull(),
  severity: mysqlEnum("severity", ["HIGH", "MEDIUM", "LOW"]).notNull(),
  confidence: decimal("confidence", { precision: 5, scale: 2 }).notNull(),
  benefitSec: decimal("benefitSec", { precision: 10, scale: 2 }).notNull(),
  risk: mysqlEnum("risk", ["LOW", "MEDIUM", "HIGH"]).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  owner: varchar("owner", { length: 128 }).notNull(),
  reason: text("reason").notNull(),
  proposed: text("proposed").notNull(),
  rollback: text("rollback").notNull(),
  evidence: text("evidence").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const auditEvents = mysqlTable("audit_events", {
  id: int("id").autoincrement().primaryKey(),
  action: varchar("action", { length: 64 }).notNull(),
  recommendationId: varchar("recommendationId", { length: 32 }).notNull(),
  user: varchar("user", { length: 128 }).notNull(),
  reason: text("reason").notNull(),
  evidenceVersion: varchar("evidenceVersion", { length: 32 }).notNull(),
  configurationVersion: varchar("configurationVersion", { length: 32 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const analysisSettings = mysqlTable("analysis_settings", {
  id: int("id").autoincrement().primaryKey(),
  configurationVersion: varchar("configurationVersion", { length: 32 }).notNull(),
  queueThreshold: decimal("queueThreshold", { precision: 6, scale: 2 }).notNull(),
  slowTaskMultiplier: decimal("slowTaskMultiplier", { precision: 6, scale: 2 }).notNull(),
  cacheMissRate: decimal("cacheMissRate", { precision: 6, scale: 2 }).notNull(),
  agentUtilisation: decimal("agentUtilisation", { precision: 6, scale: 2 }).notNull(),
  parallelisationImprovement: decimal("parallelisationImprovement", { precision: 6, scale: 2 }).notNull(),
  highImpactSeconds: decimal("highImpactSeconds", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
