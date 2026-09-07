import * as fs from "fs";
import * as path from "path";

// Create data directory if it doesn't exist
const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

interface BuildLog {
  build_id: string;
  pipeline: string;
  branch: string;
  task: string;
  task_start: string;
  task_end: string;
  duration_sec: string;
  queue_time_sec: string;
  cache_hit: string; // "true", "false", or ""
  agent_id: string;
  agent_utilisation: string; // percentage as string
  dependency_group: string;
  ground_truth: string;
}

const pipelines = ["web-app / main", "web-app / PR", "api / main", "api / release"];
const branches = ["main", "feat/checkout", "fix/alerts", "release/v2"];
const agents = ["runner-01", "runner-02", "runner-03", "runner-04"];

const logs: BuildLog[] = [];

// Seed 1: Cache Opportunity cases (30 records)
// Low cache hit, high duration for dependency install
for (let i = 1; i <= 30; i++) {
  const start = new Date(Date.now() - i * 3600000);
  const end = new Date(start.getTime() + 240 * 1000); // 4 mins
  logs.push({
    build_id: `B-CACHE-${i}`,
    pipeline: pipelines[i % 2], // web-app / main or web-app / PR
    branch: branches[i % 3],
    task: "Dependency install",
    task_start: start.toISOString(),
    task_end: end.toISOString(),
    duration_sec: "240",
    queue_time_sec: "15",
    cache_hit: "false",
    agent_id: agents[i % 4],
    agent_utilisation: "45",
    dependency_group: "setup",
    ground_truth: "CACHE_OPPORTUNITY",
  });
}

// Seed 2: Queue Bottleneck cases (30 records)
// High queue time
for (let i = 1; i <= 30; i++) {
  const start = new Date(Date.now() - i * 3600000 - 1800000);
  const end = new Date(start.getTime() + 90 * 1000);
  logs.push({
    build_id: `B-QUEUE-${i}`,
    pipeline: "web-app / PR",
    branch: "feat/checkout",
    task: "Runner allocation",
    task_start: start.toISOString(),
    task_end: end.toISOString(),
    duration_sec: "90",
    queue_time_sec: "280", // 280 seconds queue
    cache_hit: "",
    agent_id: "runner-04",
    agent_utilisation: "92",
    dependency_group: "allocation",
    ground_truth: "QUEUE_BOTTLENECK",
  });
}

// Seed 3: Slow Task cases (30 records)
// Task duration significantly above comparable tasks median
for (let i = 1; i <= 30; i++) {
  const start = new Date(Date.now() - i * 3600000 - 1200000);
  const end = new Date(start.getTime() + 480 * 1000); // 8 minutes
  logs.push({
    build_id: `B-SLOW-${i}`,
    pipeline: "web-app / main",
    branch: "main",
    task: "Static analysis",
    task_start: start.toISOString(),
    task_end: end.toISOString(),
    duration_sec: "480",
    queue_time_sec: "20",
    cache_hit: "",
    agent_id: agents[i % 4],
    agent_utilisation: "50",
    dependency_group: "analysis",
    ground_truth: "SLOW_TASK",
  });
}

// Seed 4: Agent Saturation cases (30 records)
// Agent utilisation high, high queue time too or agent pressure
for (let i = 1; i <= 30; i++) {
  const start = new Date(Date.now() - i * 3600000 - 500000);
  const end = new Date(start.getTime() + 150 * 1000);
  logs.push({
    build_id: `B-SAT-${i}`,
    pipeline: "api / main",
    branch: "main",
    task: "Shared staging runner",
    task_start: start.toISOString(),
    task_end: end.toISOString(),
    duration_sec: "150",
    queue_time_sec: "180",
    cache_hit: "",
    agent_id: "runner-01",
    agent_utilisation: "96", // 96% utilization
    dependency_group: "deploy",
    ground_truth: "AGENT_SATURATION",
  });
}

// Seed 5: Parallelisation Opportunity cases (30 records)
// Unit tests and static analysis could run concurrently
for (let i = 1; i <= 30; i++) {
  const start = new Date(Date.now() - i * 3600000 - 300000);
  const end = new Date(start.getTime() + 380 * 1000);
  logs.push({
    build_id: `B-PAR-${i}`,
    pipeline: "web-app / main",
    branch: "main",
    task: "Unit tests + static analysis",
    task_start: start.toISOString(),
    task_end: end.toISOString(),
    duration_sec: "380",
    queue_time_sec: "10",
    cache_hit: "",
    agent_id: agents[i % 4],
    agent_utilisation: "35",
    dependency_group: "tests-and-analysis", // multiple tasks in one group
    ground_truth: "PARALLELISATION_OPPORTUNITY",
  });
}

// Seed 6: Normal / None cases (100 records)
for (let i = 1; i <= 100; i++) {
  const start = new Date(Date.now() - i * 1800000);
  const end = new Date(start.getTime() + 100 * 1000);
  logs.push({
    build_id: `B-NORM-${i}`,
    pipeline: "api / release",
    branch: "release/v2",
    task: "Run backend tests",
    task_start: start.toISOString(),
    task_end: end.toISOString(),
    duration_sec: "100",
    queue_time_sec: "8",
    cache_hit: "true",
    agent_id: "runner-02",
    agent_utilisation: "60",
    dependency_group: "tests",
    ground_truth: "NONE",
  });
}

// Edge Case A: Missing task_start or task_end (5 records)
for (let i = 1; i <= 5; i++) {
  const start = new Date(Date.now() - i * 3600000);
  logs.push({
    build_id: `B-EDGE-MISSING-${i}`,
    pipeline: "web-app / main",
    branch: "main",
    task: "Checkout code",
    task_start: i % 2 === 0 ? "" : start.toISOString(),
    task_end: i % 2 === 0 ? start.toISOString() : "",
    duration_sec: "0",
    queue_time_sec: "5",
    cache_hit: "",
    agent_id: "runner-03",
    agent_utilisation: "40",
    dependency_group: "setup",
    ground_truth: "NONE",
  });
}

// Edge Case B: Negative duration (5 records)
for (let i = 1; i <= 5; i++) {
  const start = new Date(Date.now() - i * 3600000);
  const end = new Date(start.getTime() - 60 * 1000); // 1 minute in the past!
  logs.push({
    build_id: `B-EDGE-NEG-${i}`,
    pipeline: "web-app / main",
    branch: "main",
    task: "Compile assets",
    task_start: start.toISOString(),
    task_end: end.toISOString(),
    duration_sec: "-60",
    queue_time_sec: "10",
    cache_hit: "",
    agent_id: "runner-03",
    agent_utilisation: "40",
    dependency_group: "build",
    ground_truth: "NONE",
  });
}

// Edge Case C: Missing cache/dependency information (5 records)
for (let i = 1; i <= 5; i++) {
  const start = new Date(Date.now() - i * 3600000);
  const end = new Date(start.getTime() + 150 * 1000);
  logs.push({
    build_id: `B-EDGE-MISSDATA-${i}`,
    pipeline: "web-app / main",
    branch: "main",
    task: "Dependency cache query",
    task_start: start.toISOString(),
    task_end: end.toISOString(),
    duration_sec: "150",
    queue_time_sec: "5",
    cache_hit: "", // Missing cache_hit on a task that is labeled CACHE_OPPORTUNITY in ground truth to test lower confidence
    agent_id: "runner-03",
    agent_utilisation: "40",
    dependency_group: "", // Missing dependency group
    ground_truth: "CACHE_OPPORTUNITY",
  });
}

// Write to CSV
const csvHeaders = [
  "build_id",
  "pipeline",
  "branch",
  "task",
  "task_start",
  "task_end",
  "duration_sec",
  "queue_time_sec",
  "cache_hit",
  "agent_id",
  "agent_utilisation",
  "dependency_group",
  "ground_truth"
];

const csvRows = [
  csvHeaders.join(","),
  ...logs.map(log => [
    log.build_id,
    `"${log.pipeline}"`,
    log.branch,
    `"${log.task}"`,
    log.task_start,
    log.task_end,
    log.duration_sec,
    log.queue_time_sec,
    log.cache_hit,
    log.agent_id,
    log.agent_utilisation,
    log.dependency_group ? `"${log.dependency_group}"` : "",
    log.ground_truth
  ].join(","))
];

const csvContent = csvRows.join("\n");
fs.writeFileSync(path.join(dataDir, "ci_build_logs.csv"), csvContent, "utf-8");
console.log(`Generated realistic validation dataset with ${logs.length} records in data/ci_build_logs.csv`);
