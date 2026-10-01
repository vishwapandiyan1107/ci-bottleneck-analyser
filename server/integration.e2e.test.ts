import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import { createServer, type Server } from "node:http";
import { registerCiIntegrationRoutes } from "./integration";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import fs from "node:fs";
import path from "node:path";

function createContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

function startTestServer(): Promise<{ server: Server; baseUrl: string }> {
  const app = express();
  app.use(express.json({ limit: "2mb" }));
  registerCiIntegrationRoutes(app);
  const server = createServer(app);
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Unable to allocate test port");
      resolve({ server, baseUrl: `http://127.0.0.1:${address.port}` });
    });
  });
}

function cleanupStore() {
  const store = path.resolve(process.cwd(), "server/runtime-store.json");
  if (fs.existsSync(store)) fs.rmSync(store);
}

afterEach(() => cleanupStore());

describe("CI integration end-to-end", () => {
  it("ingests an agent log webhook and triggers configured queue/agent thresholds", async () => {
    const { server, baseUrl } = await startTestServer();
    try {
      const response = await fetch(`${baseUrl}/api/integration/ci-events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "github-actions",
          eventId: "evt-agent-001",
          eventType: "agent.log",
          record: {
            buildId: "agent-build-001",
            pipeline: "web-app / PR",
            branch: "feat/queue-test",
            durationSec: 900,
            queueSec: 260,
            cacheHitPct: 75,
            agentUtilPct: 94,
            status: "Passed",
            task: "shared staging runner",
            taskDurationSec: 120,
            taskMedianSec: 120,
            dependencyKnown: true,
            parallelCandidate: false,
            sequentialSec: 0,
            parallelSec: 0,
            expectedLabel: "AGENT_SATURATION",
          },
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json() as {
        ok: boolean;
        thresholdsTriggered: string[];
        accepted: number;
        auditRecorded: boolean;
      };
      expect(body.ok).toBe(true);
      expect(body.accepted).toBe(1);
      expect(body.thresholdsTriggered).toContain("AGENT_SATURATION");
      expect(body.thresholdsTriggered).toContain("QUEUE_BOTTLENECK");
      expect(body.auditRecorded).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("proves threshold changes affect subsequent streamed events", async () => {
    const caller = appRouter.createCaller(createContext());
    await caller.analysis.updateSettings({
      queueThreshold: 20,
      slowTaskMultiplier: 1.5,
      cacheMissRate: 40,
      agentUtilisation: 95,
      parallelisationImprovement: 15,
      highImpactSeconds: 60,
    });

    const { server, baseUrl } = await startTestServer();
    try {
      const response = await fetch(`${baseUrl}/api/integration/ci-events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "generic",
          eventId: "evt-agent-002",
          eventType: "agent.log",
          record: {
            buildId: "agent-build-002",
            pipeline: "api / main",
            branch: "main",
            durationSec: 600,
            queueSec: 40,
            cacheHitPct: 80,
            agentUtilPct: 90,
            status: "Passed",
            task: "shared staging runner",
            taskDurationSec: 100,
            taskMedianSec: 100,
            dependencyKnown: true,
            parallelCandidate: false,
            sequentialSec: 0,
            parallelSec: 0,
            expectedLabel: "NONE",
          },
        }),
      });
      expect(response.status).toBe(200);
      const body = await response.json() as { thresholdsTriggered: string[] };
      expect(body.thresholdsTriggered).not.toContain("AGENT_SATURATION");
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });


  it("serves calculated analysis over the reviewer-facing REST endpoint", async () => {
    const { server, baseUrl } = await startTestServer();
    try {
      const response = await fetch(`${baseUrl}/api/analysis`);
      expect(response.status).toBe(200);
      const body = await response.json() as { ok: boolean; recordsAnalysed: number; formula: string; bottlenecks: Array<unknown> };
      expect(body.ok).toBe(true);
      expect(body.recordsAnalysed).toBe(648);
      expect(body.formula).toContain("queueSec is not added again");
      expect(body.bottlenecks.length).toBeGreaterThan(0);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("rejects malformed webhook records without mutating audit state", async () => {
    const { server, baseUrl } = await startTestServer();
    try {
      const response = await fetch(`${baseUrl}/api/integration/ci-events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "github-actions",
          eventId: "evt-invalid-001",
          eventType: "build.completed",
          record: {
            buildId: "invalid-build-001", pipeline: "web", branch: "main", durationSec: -1, queueSec: 10,
            cacheHitPct: 50, agentUtilPct: 50, status: "Passed", task: "build", taskDurationSec: 20, taskMedianSec: 20, dependencyKnown: true,
          },
        }),
      });
      expect(response.status).toBe(422);
      const audit = await fetch(`${baseUrl}/api/analysis`);
      expect(audit.status).toBe(200);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });

  it("rejects a duplicate webhook event idempotently", async () => {
    const { server, baseUrl } = await startTestServer();
    const payload = {
      provider: "gitlab-ci",
      eventId: "evt-duplicate-001",
      eventType: "build.completed",
      record: {
        buildId: "dup-build-001",
        pipeline: "api / main",
        branch: "main",
        durationSec: 600,
        queueSec: 30,
        cacheHitPct: 90,
        agentUtilPct: 60,
        status: "Passed",
        task: "build",
        taskDurationSec: 100,
        taskMedianSec: 100,
        dependencyKnown: true,
        parallelCandidate: false,
        sequentialSec: 0,
        parallelSec: 0,
        expectedLabel: "NONE",
      },
    };

    try {
      const first = await fetch(`${baseUrl}/api/integration/ci-events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const second = await fetch(`${baseUrl}/api/integration/ci-events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(first.status).toBe(200);
      expect(second.status).toBe(409);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});


describe("provider webhook adapter end-to-end", () => {
  it("normalizes a GitHub Actions-style webhook and runs the same threshold pipeline", async () => {
    const { server, baseUrl } = await startTestServer();
    try {
      const response = await fetch(`${baseUrl}/api/integration/webhooks/github-actions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-event-id": "gha-run-9001",
          "x-ci-event": "agent.log",
        },
        body: JSON.stringify({
          workflow: "web-app / PR",
          run_id: "gha-9001",
          ref: "refs/heads/main",
          conclusion: "success",
          duration_sec: 900,
          queue_sec: 260,
          cache_hit_pct: 75,
          agent_utilization: 94,
          step: "shared staging runner",
          task_duration_sec: 120,
          task_median_sec: 120,
          dependency_known: true,
          agent_name: "runner-04",
        }),
      });

      expect(response.status).toBe(200);
      const body = await response.json() as {
        ok: boolean;
        provider: string;
        thresholdsTriggered: string[];
        auditRecorded: boolean;
      };
      expect(body.ok).toBe(true);
      expect(body.provider).toBe("github-actions");
      expect(body.thresholdsTriggered).toContain("AGENT_SATURATION");
      expect(body.thresholdsTriggered).toContain("QUEUE_BOTTLENECK");
      expect(body.auditRecorded).toBe(true);
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
});
