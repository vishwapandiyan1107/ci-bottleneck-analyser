import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AnalysisSettings, Recommendation } from "./analysisEngine";
import { defaultAnalysisSettings } from "./analysisEngine";

export type AuditEvent = {
  id: string;
  action: string;
  recommendationId: string;
  user: string;
  reason: string;
  evidenceVersion: string;
  configurationVersion: string;
  createdAt: string;
};

export type IntegrationEvent = {
  eventId: string;
  provider: string;
  eventType: string;
  acceptedRecords: number;
  createdAt: string;
};

type Store = {
  settings: AnalysisSettings;
  configurationVersion: number;
  recommendations: Recommendation[];
  audit: AuditEvent[];
  integrationEvents: IntegrationEvent[];
  previousRecommendationStatus: Record<string, Recommendation["status"]>;
};

const filename = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "runtime-store.json");

const initial: Store = {
  settings: { ...defaultAnalysisSettings },
  configurationVersion: 1,
  recommendations: [],
  audit: [],
  integrationEvents: [],
  previousRecommendationStatus: {},
};

function read(): Store {
  try {
    if (!fs.existsSync(filename)) return structuredClone(initial);
    const parsed = JSON.parse(fs.readFileSync(filename, "utf8")) as Partial<Store>;
    return {
      ...structuredClone(initial),
      ...parsed,
      settings: parsed.settings ?? { ...defaultAnalysisSettings },
      recommendations: parsed.recommendations ?? [],
      audit: parsed.audit ?? [],
      integrationEvents: parsed.integrationEvents ?? [],
      previousRecommendationStatus: parsed.previousRecommendationStatus ?? {},
    };
  } catch {
    return structuredClone(initial);
  }
}

function write(store: Store) {
  const temp = `${filename}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(store, null, 2), "utf8");
  fs.renameSync(temp, filename);
}

export function getStore() {
  return read();
}

export function saveSettings(settings: AnalysisSettings) {
  const store = read();
  store.settings = settings;
  store.configurationVersion += 1;
  write(store);
  return store;
}

export function setRecommendations(recommendations: Recommendation[]) {
  const store = read();
  store.recommendations = recommendations;
  write(store);
  return store;
}

const allowedTransitions: Record<string, Recommendation["status"][]> = {
  approve: ["Pending review"],
  reject: ["Pending review"],
  override: ["Pending review"],
  apply: ["Approved", "Overridden"],
  rollback: ["Applied"],
};

export function updateRecommendation(id: string, action: "approve" | "reject" | "override" | "apply" | "rollback") {
  const store = read();
  const item = store.recommendations.find(r => r.id === id);
  if (!item) return undefined;

  const allowed = allowedTransitions[action] ?? [];
  if (!allowed.includes(item.status)) {
    throw new Error(`Cannot ${action} recommendation ${id} from status ${item.status}.`);
  }

  const previousStatus = item.status;

  if (action === "apply") {
    // Keep the exact reviewed state so rollback restores it instead of merely
    // changing the label shown in the UI.
    store.previousRecommendationStatus[id] = item.status;
    item.status = "Applied";
  } else if (action === "rollback") {
    const restoredStatus = store.previousRecommendationStatus[id] ?? "Approved";
    item.status = restoredStatus;
    delete store.previousRecommendationStatus[id];
  } else {
    item.status =
      action === "approve" ? "Approved" :
      action === "reject" ? "Rejected" :
      "Overridden";
  }

  write(store);
  return {
    ...item,
    previousStatus,
  };
}

export function appendAudit(event: Omit<AuditEvent, "id" | "createdAt">) {
  const store = read();
  const id = `AUD-${String(store.audit.length + 1).padStart(5, "0")}`;
  const item = { ...event, id, createdAt: new Date().toISOString() };
  store.audit.unshift(item);
  write(store);
  return item;
}

export function appendIntegrationEvent(event: Omit<IntegrationEvent, "createdAt">) {
  const store = read();
  store.integrationEvents.unshift({ ...event, createdAt: new Date().toISOString() });
  store.integrationEvents = store.integrationEvents.slice(0, 500);
  write(store);
  return store.integrationEvents[0];
}

export function hasIntegrationEvent(eventId: string) {
  return read().integrationEvents.some(event => event.eventId === eventId);
}
