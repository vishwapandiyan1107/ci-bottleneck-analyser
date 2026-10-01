import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpen,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Code2,
  Database,
  Download,
  FileClock,
  FileText,
  Filter,
  Gauge,
  GitBranch,
  GitCommitHorizontal,
  HardDrive,
  LayoutDashboard,
  ListFilter,
  Menu,
  MoreHorizontal,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Split,
  TerminalSquare,
  UploadCloud,
  Users,
  X,
  Zap,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const navItems = [
  { key: "overview", label: "Overview", icon: LayoutDashboard, section: "Monitor" },
  { key: "builds", label: "Build explorer", icon: GitBranch, section: "Monitor" },
  { key: "bottlenecks", label: "Bottlenecks", icon: Activity, section: "Analyse", count: 7 },
  { key: "recommendations", label: "Recommendations", icon: Sparkles, section: "Analyse", count: 4 },
  { key: "experiment", label: "Experiment", icon: BarChart3, section: "Validate" },
  { key: "audit", label: "Audit trail", icon: FileClock, section: "Validate" },
  { key: "settings", label: "Thresholds", icon: Settings2, section: "Configure" },
];

const buildRows = [
  { id: "build-8f2a1", pipeline: "web-app / main", branch: "main", duration: "18m 42s", queue: "4m 11s", cache: "18%", agent: "runner-04", status: "Failed", tone: "red", commit: "8f2a1c0" },
  { id: "build-8f29c8", pipeline: "web-app / main", branch: "main", duration: "14m 05s", queue: "3m 48s", cache: "24%", agent: "runner-02", status: "Passed", tone: "green", commit: "8f29c84" },
  { id: "build-8f281b", pipeline: "api / release", branch: "release/v2", duration: "11m 37s", queue: "2m 03s", cache: "76%", agent: "runner-01", status: "Passed", tone: "green", commit: "8f281b2" },
  { id: "build-8f274e", pipeline: "web-app / PR", branch: "feat/checkout", duration: "22m 19s", queue: "8m 22s", cache: "12%", agent: "runner-04", status: "Retrying", tone: "amber", commit: "8f274ea" },
  { id: "build-8f2630", pipeline: "mobile / main", branch: "main", duration: "9m 52s", queue: "1m 17s", cache: "83%", agent: "runner-03", status: "Passed", tone: "green", commit: "8f26308" },
  { id: "build-8f25bd", pipeline: "web-app / PR", branch: "fix/alerts", duration: "13m 27s", queue: "4m 03s", cache: "31%", agent: "runner-02", status: "Passed", tone: "green", commit: "8f25bd1" },
  { id: "build-8f248e", pipeline: "api / main", branch: "main", duration: "8m 49s", queue: "0m 42s", cache: "91%", agent: "runner-01", status: "Passed", tone: "green", commit: "8f248e9" },
  { id: "build-8f23aa", pipeline: "web-app / main", branch: "main", duration: "16m 54s", queue: "5m 29s", cache: "22%", agent: "runner-04", status: "Passed", tone: "green", commit: "8f23aa0" },
];

const bottleneckRows = [
  { id: "BOT-102", label: "CACHE_OPPORTUNITY", task: "Dependency install", pipeline: "web-app / main", severity: "HIGH", confidence: 92, impact: "3m 18s / build", evidence: ["Cache hit rate 18%", "P95 duration 7m 42s", "126 occurrences"], action: "Stabilise cache key and persist npm store", color: "lime" },
  { id: "BOT-087", label: "QUEUE_BOTTLENECK", task: "Runner allocation", pipeline: "web-app / PR", severity: "HIGH", confidence: 89, impact: "2m 41s / build", evidence: ["Median queue 4m 08s", "27% of pipeline time", "runner-04 at 96%"], action: "Add one burst runner during office hours", color: "amber" },
  { id: "BOT-114", label: "SLOW_TASK", task: "Static analysis", pipeline: "web-app / main", severity: "MEDIUM", confidence: 86, impact: "1m 10s / build", evidence: ["Median duration 4m 52s", "2.1× pipeline task median", "88 occurrences"], action: "Split typecheck from lint and cache tsbuildinfo", color: "blue" },
  { id: "BOT-091", label: "AGENT_SATURATION", task: "Shared staging runner", pipeline: "all pipelines", severity: "HIGH", confidence: 81, impact: "1m 54s / build", evidence: ["Utilisation 93%", "P90 queue 8m 22s", "4 of 5 agents hot"], action: "Reduce noisy jobs before increasing concurrency", color: "red" },
  { id: "BOT-076", label: "PARALLELISATION_OPPORTUNITY", task: "Unit tests + static analysis", pipeline: "web-app / main", severity: "MEDIUM", confidence: 78, impact: "2m 06s / build", evidence: ["Sequential 6m 22s", "Parallel estimate 4m 16s", "No dependency edge"], action: "Run independent quality gates concurrently", color: "violet" },
];

const initialRecommendations = [
  { id: "REC-1842", title: "Enable dependency cache", type: "CACHE_OPPORTUNITY", severity: "HIGH", confidence: 92, benefit: "3m 18s / build", risk: "LOW", status: "Pending review", owner: "Platform", reason: "Identical lockfiles are downloading dependencies on most runs despite stable cache keys.", proposed: "Persist npm store between jobs; key on lockfile hash + node version.", rollback: "Disable cache step and restore the previous install command.", evidence: ["Cache hit rate: 18%", "Cache miss rate: 82%", "Median install: 3m 44s", "P95 install: 7m 42s", "Occurrences analysed: 126", "Estimated saving: 3m 18s / build"] },
  { id: "REC-1843", title: "Parallelise quality gates", type: "PARALLELISATION_OPPORTUNITY", severity: "MEDIUM", confidence: 87, benefit: "2m 06s / build", risk: "MEDIUM", status: "Approved", owner: "DevEx", reason: "Unit tests and static analysis have no dependency relationship and consume 6m 22s sequentially.", proposed: "Run unit tests and static analysis as concurrent jobs after build artefact creation.", rollback: "Restore sequential needs: [unit-tests, static-analysis].", evidence: ["Sequential time: 6m 22s", "Parallel estimate: 4m 16s", "Potential saving: 2m 06s", "Dependency graph: clear"] },
  { id: "REC-1844", title: "Relieve runner saturation", type: "AGENT_SATURATION", severity: "HIGH", confidence: 81, benefit: "1m 54s / build", risk: "HIGH", status: "Pending review", owner: "SRE", reason: "Four of five shared agents are operating above the 90% high-priority threshold.", proposed: "Add one burst runner and cap staging jobs at 6 concurrent workers.", rollback: "Remove burst runner and revert worker cap to 2.", evidence: ["Average utilisation: 93%", "P90 queue: 8m 22s", "Runner-04: 96%", "Failure retries: 6.4%"] },
  { id: "REC-1845", title: "Normalise cache keys", type: "CACHE_OPPORTUNITY", severity: "LOW", confidence: 71, benefit: "41s / build", risk: "LOW", status: "Rejected", owner: "Web", reason: "Branch-specific cache key suffixes create avoidable misses on feature branches.", proposed: "Drop branch name from the dependency cache key and retain lockfile scope.", rollback: "Restore branch-scoped cache key suffix.", evidence: ["Feature branch hit rate: 31%", "Main hit rate: 76%", "43 occurrences"] },
];

const areaData = [
  { day: "Mon", baseline: 15.8, measured: 11.2 }, { day: "Tue", baseline: 15.1, measured: 10.8 }, { day: "Wed", baseline: 14.7, measured: 9.4 }, { day: "Thu", baseline: 14.4, measured: 9.1 }, { day: "Fri", baseline: 14.8, measured: 8.9 }, { day: "Sat", baseline: 13.9, measured: 8.3 }, { day: "Sun", baseline: 14.3, measured: 8.1 },
];

const taskData = [
  { name: "Deps", value: 29, fill: "#b7f35b" }, { name: "Tests", value: 24, fill: "#f4f7fb" }, { name: "Analysis", value: 21, fill: "#bd8cff" }, { name: "Build", value: 16, fill: "#f6b94b" }, { name: "Other", value: 10, fill: "#3c4a5c" },
];

const auditSeed = [
  { time: "Today · 16:42:10", user: "DevOps Admin", action: "Approved", rec: "REC-1843", detail: "Validated concurrent quality gates against staging", tone: "green" },
  { time: "Today · 15:18:47", user: "SRE Team", action: "Override", rec: "REC-1844", detail: "Risk changed from MEDIUM to HIGH", tone: "amber" },
  { time: "Today · 14:06:22", user: "System", action: "Detected", rec: "BOT-102", detail: "Evidence version Dataset v1.4", tone: "blue" },
  { time: "Yesterday · 18:31:04", user: "DevEx", action: "Rejected", rec: "REC-1845", detail: "Branch cache key required for release isolation", tone: "red" },
  { time: "Yesterday · 11:22:19", user: "Platform", action: "Applied", rec: "REC-1839", detail: "Cache restore step simulated", tone: "lime" },
];

const metricTargets = {
  feedback: { baseline: "14.8m", target: "< 10m", measured: "9.1m", improvement: "38.5%" },
  queue: { baseline: "3.7m", target: "< 3m", measured: "2.2m", improvement: "40.5%" },
  cache: { baseline: "41%", target: "> 70%", measured: "74%", improvement: "+33 pts" },
  agent: { baseline: "91%", target: "< 85%", measured: "82%", improvement: "−9 pts" },
};

type ViewKey = (typeof navItems)[number]["key"];

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: string }) {
  return <span className={cn("status-pill", `status-${tone}`)}>{children}</span>;
}

function SectionHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="section-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1>{description && <p>{description}</p>}</div>{action}</div>;
}

function KpiCard({ label, value, meta, trend, tone = "lime", icon: Icon }: { label: string; value: string; meta: string; trend?: string; tone?: string; icon: typeof Activity }) {
  return <div className="kpi-card"><div className="kpi-top"><span>{label}</span><span className={cn("icon-chip", `chip-${tone}`)}><Icon size={15} /></span></div><div className="kpi-value">{value}</div><div className="kpi-meta"><span>{meta}</span>{trend && <span className={cn("trend", trend.startsWith("−") || trend.startsWith("-") ? "trend-down" : "trend-up")}>{trend.startsWith("−") || trend.startsWith("-") ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{trend}</span>}</div></div>;
}

function EmptyState({ icon: Icon, title, copy }: { icon: typeof Activity; title: string; copy: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={19} /></span><strong>{title}</strong><p>{copy}</p></div>;
}

function mapApiRecommendations(items: Array<{
  id: string; title: string; type: string; severity: "HIGH" | "MEDIUM" | "LOW";
  confidence: number; benefitSec: number; risk: "LOW" | "MEDIUM" | "HIGH";
  status: string; owner: string; reason: string; proposed: string; rollback: string; evidence: string[];
}>) {
  return items.map(item => ({
    id: item.id,
    title: item.title,
    type: item.type,
    severity: item.severity,
    confidence: item.confidence,
    benefit: `${Math.round(item.benefitSec / 60 * 100) / 100}m / build`,
    risk: item.risk,
    status: item.status,
    owner: item.owner,
    reason: item.reason,
    proposed: item.proposed,
    rollback: item.rollback,
    evidence: item.evidence,
  }));
}

function mapAnalysisBuildRows(records: any[]) {
  return records.map((row) => ({
    id: row.buildId,
    pipeline: row.pipeline,
    branch: row.branch,
    duration: `${Math.round(row.durationSec / 60)}m ${Math.round(row.durationSec % 60)}s`,
    queue: `${Math.round(row.queueSec / 60)}m ${Math.round(row.queueSec % 60)}s`,
    cache: `${Math.round(row.cacheHitPct)}%`,
    agent: row.agentName ?? "shared",
    status: row.status,
    tone: row.status === "Failed" ? "red" : row.status === "Retrying" ? "amber" : "green",
    commit: String(row.buildId).slice(-7),
  }));
}

function mapApiBottlenecks(items: Array<any>) {
  const colorFor = (label: string) => label === "AGENT_SATURATION" ? "red" : label === "QUEUE_BOTTLENECK" ? "amber" : label === "PARALLELISATION_OPPORTUNITY" ? "violet" : label === "SLOW_TASK" ? "blue" : "lime";
  return items.map(item => ({
    id: item.id,
    label: item.label,
    task: item.task,
    pipeline: item.pipeline,
    severity: item.severity,
    confidence: item.confidence,
    impact: `${Math.round(item.impactSec / 60 * 100) / 100}m / build`,
    evidence: item.evidence,
    action: item.action,
    color: colorFor(item.label),
  }));
}

function mapAuditEvents(events: Array<any>) {
  return events.map((item) => ({
    time: new Date(item.createdAt).toLocaleString(),
    user: item.user,
    action: item.action,
    rec: item.recommendationId,
    detail: item.reason,
    tone: item.action.toLowerCase().includes("reject") ? "red" : item.action.toLowerCase().includes("override") ? "amber" : item.action.toLowerCase().includes("apply") ? "lime" : "blue",
  }));
}

function downloadCsv(filename: string, rows: Array<Record<string, unknown>>) {
  if (!rows.length) {
    toast.info("Nothing to export");
    return;
  }
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map(row => headers.map(header => escape(row[header])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
  toast.success("CSV exported", { description: filename });
}

export default function Home() {
  const [view, setView] = useState<ViewKey>("overview");
  const [mobileNav, setMobileNav] = useState(false);
  const [demoRunning, setDemoRunning] = useState(false);
  const [demoStep, setDemoStep] = useState(0);
  const [optimisedApplied, setOptimisedApplied] = useState(true);
  const [liveAnalysis, setLiveAnalysis] = useState<any>(null);
  const [recommendations, setRecommendations] = useState(initialRecommendations);
  const [audit, setAudit] = useState(auditSeed);
  const [search, setSearch] = useState("");
  const [buildFilter, setBuildFilter] = useState("All");
  const [overrideId, setOverrideId] = useState<string | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [lastDataset, setLastDataset] = useState<{ content: string; format: "csv" | "json"; datasetVersion: string } | null>(null);
  const [settings, setSettings] = useState({ queue: 20, slow: 1.5, cache: 40, agent: 80, parallel: 15, impact: 60 });
  const overviewQuery = trpc.analysis.overview.useQuery();
  const recommendationsQuery = trpc.analysis.recommendations.useQuery();
  const auditQuery = trpc.analysis.audit.useQuery();
  const settingsQuery = trpc.analysis.settings.useQuery();

  useEffect(() => {
    if (overviewQuery.data) {
      setLiveAnalysis(overviewQuery.data);
      setRecommendations(mapApiRecommendations(overviewQuery.data.recommendations));
      setOptimisedApplied(true);
    }
  }, [overviewQuery.data]);

  useEffect(() => {
    if (recommendationsQuery.data) setRecommendations(mapApiRecommendations(recommendationsQuery.data));
  }, [recommendationsQuery.data]);

  useEffect(() => {
    if (auditQuery.data) setAudit(mapAuditEvents(auditQuery.data));
  }, [auditQuery.data]);

  useEffect(() => {
    if (settingsQuery.data) {
      setSettings({
        queue: Number(settingsQuery.data.queueThreshold),
        slow: Number(settingsQuery.data.slowTaskMultiplier),
        cache: Number(settingsQuery.data.cacheMissRate),
        agent: Number(settingsQuery.data.agentUtilisation),
        parallel: Number(settingsQuery.data.parallelisationImprovement),
        impact: Number(settingsQuery.data.highImpactSeconds),
      });
    }
  }, [settingsQuery.data]);
  const demoMutation = trpc.analysis.demo.useMutation({
    onSuccess: (result) => {
      setRecommendations(mapApiRecommendations(result.recommendations));
      setLiveAnalysis(result);
      setOptimisedApplied(true);
      toast.success("Demo dataset analysed", { description: `${result.validRecords} valid records · ${result.bottlenecks.length} bottlenecks detected.` });
    },
    onError: (error) => toast.error("Analysis failed", { description: error.message }),
  });
  const analyseMutation = trpc.analysis.analyseCsv.useMutation({
    onSuccess: (result) => {
      setRecommendations(mapApiRecommendations(result.recommendations));
      setLiveAnalysis(result);
      setOptimisedApplied(true);
      void recommendationsQuery.refetch();
      void auditQuery.refetch();
      toast.success("Build logs analysed", { description: `${result.validRecords} valid records · ${result.validationErrors} rejected.` });
      navTo("bottlenecks");
    },
    onError: (error) => toast.error("Upload analysis failed", { description: error.message }),
  });
  async function rerunAnalysis() {
    if (lastDataset) {
      analyseMutation.mutate(lastDataset);
    } else {
      demoMutation.mutate();
    }
  }

  const settingsMutation = trpc.analysis.updateSettings.useMutation({
    onSuccess: (result) => {
      void settingsQuery.refetch();
      void auditQuery.refetch();
      void rerunAnalysis();
      toast.success("Configuration saved", { description: `Configuration ${result.configurationVersion} is active and the analysis was re-run.` });
    },
    onError: (error) => toast.error("Configuration failed", { description: error.message }),
  });

  const pending = recommendations.filter((rec) => rec.status === "Pending review").length;
  const displayRows = useMemo(() => liveAnalysis?.sampleRecords ? mapAnalysisBuildRows(liveAnalysis.sampleRecords) : buildRows, [liveAnalysis]);
  const filteredBuilds = useMemo(() => displayRows.filter((row) => {
    const matchesSearch = [row.id, row.pipeline, row.branch, row.agent].join(" ").toLowerCase().includes(search.toLowerCase());
    const matchesFilter = buildFilter === "All" || row.status === buildFilter;
    return matchesSearch && matchesFilter;
  }), [displayRows, search, buildFilter]);
  const visibleRecommendations = recommendations.filter((rec) => rec.title.toLowerCase().includes(search.toLowerCase()) || rec.type.toLowerCase().includes(search.toLowerCase()));
  const currentOverride = recommendations.find((rec) => rec.id === overrideId);

  const pushAudit = (action: string, rec: string, detail: string, tone: string) => {
    setAudit((items) => [{ time: "Just now", user: "You · Demo user", action, rec, detail, tone }, ...items]);
  };

  const trpcAction = trpc.analysis.recommendationAction.useMutation({
    onSuccess: () => { void recommendationsQuery.refetch(); void auditQuery.refetch(); },
    onError: (error) => {
      void recommendationsQuery.refetch();
      void auditQuery.refetch();
      toast.error("Decision was not persisted", { description: error.message });
    },
  });

  const updateRecommendation = (id: string, status: string, action: string, detail: string, tone: string) => {
    setRecommendations((items) => items.map((item) => item.id === id ? { ...item, status } : item));
    pushAudit(action, id, detail, tone);
    const actionMap: Record<string, "approve" | "reject" | "override" | "apply" | "rollback"> = {
      Approved: "approve", Rejected: "reject", Overridden: "override", Applied: "apply", "Rolled back": "rollback",
    };
    const apiAction = actionMap[status];
    if (apiAction) {
      trpcAction.mutate({ id, action: apiAction, reason: detail });
    }
    toast.success(`${id} ${status.toLowerCase()}`, { description: detail });
  };

  const runDemo = () => {
    setDemoRunning(true);
    setDemoStep(0);
    setOptimisedApplied(false);
    [400, 900, 1400, 1900, 2400].forEach((delay, index) => setTimeout(() => {
      setDemoStep(index + 1);
      if (index === 4) {
        setDemoRunning(false);
        demoMutation.mutate();
      }
    }, delay));
  };

  const saveOverride = () => {
    if (!overrideId || !overrideReason.trim()) {
      toast.error("Override reason required", { description: "Add context so the decision is auditable." });
      return;
    }
    updateRecommendation(overrideId, "Overridden", "Override", overrideReason.trim(), "amber");
    setOverrideId(null);
    setOverrideReason("");
  };

  const navTo = (next: ViewKey) => { setView(next); setMobileNav(false); window.scrollTo({ top: 0, behavior: "smooth" }); };

  return <div className="app-shell">
    <aside className={cn("sidebar", mobileNav && "sidebar-open")}>
      <div className="brand-lockup"><div className="brand-mark"><TerminalSquare size={20} /></div><div><strong>CI / SIGNAL</strong><span>Performance intelligence</span></div></div>
      <div className="workspace-switcher"><span className="workspace-dot" /> <span>Acme engineering</span><ChevronRight size={14} /></div>
      <div className="nav-scroll">
        {(["Monitor", "Analyse", "Validate", "Configure"] as const).map((section) => <div className="nav-group" key={section}><div className="nav-section-label">{section}</div>{navItems.filter((item) => item.section === section).map((item) => { const Icon = item.icon; return <button key={item.key} className={cn("nav-item", view === item.key && "nav-active")} onClick={() => navTo(item.key)}><Icon size={16} /><span>{item.label}</span>{item.count && <span className="nav-count">{item.count}</span>}</button>; })}</div>)}
      </div>
      <div className="sidebar-bottom"><div className="system-status"><span className="pulse-dot" /><div><strong>Pipeline feed live</strong><span>Last sync 2m ago</span></div><MoreHorizontal size={15} /></div><button className="user-card" onClick={() => toast("Demo user", { description: "DevOps Admin · workspace owner" })}><span className="avatar">AK</span><div><strong>Alex Kim</strong><span>DevOps Admin</span></div><ChevronRight size={14} /></button></div>
    </aside>

    <main className="main-canvas">
      <header className="topbar"><div className="mobile-brand"><button className="icon-button" onClick={() => setMobileNav((open) => !open)} aria-label="Toggle navigation"><Menu size={18} /></button><span>CI / SIGNAL</span></div><div className="breadcrumb"><span>Workspace</span><ChevronRight size={13} /><strong>{navItems.find((item) => item.key === view)?.label}</strong></div><div className="top-actions"><div className="top-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search signals..." /><kbd>⌘ K</kbd></div><button className="icon-button" onClick={() => toast("No new alerts", { description: "Everything is within your configured thresholds." })} aria-label="Notifications"><Bell size={17} /><span className="notification-dot" /></button><button className="demo-button" onClick={runDemo}><Play size={13} fill="currentColor" /> Demo mode</button></div></header>

      <div className="page-content">
        {view === "overview" && <OverviewView optimisedApplied={optimisedApplied} analysis={liveAnalysis} onRunDemo={runDemo} onRefresh={() => void rerunAnalysis()} onNavigate={navTo} />}
        {view === "builds" && <BuildsView rows={filteredBuilds} totalRecords={liveAnalysis?.recordsAnalysed ?? 648} search={search} filter={buildFilter} setFilter={setBuildFilter} onUploadLogs={(csv, format) => {
          const datasetVersion = `uploaded-${new Date().toISOString().slice(0, 10)}`;
          setLastDataset({ content: csv, format, datasetVersion });
          analyseMutation.mutate({ csv, format, datasetVersion });
        }} onLoadDemo={() => { setLastDataset(null); demoMutation.mutate(); }} />}
        {view === "bottlenecks" && <BottlenecksView bottlenecks={liveAnalysis?.bottlenecks ? mapApiBottlenecks(liveAnalysis.bottlenecks) : bottleneckRows} onRefresh={() => void rerunAnalysis()} onNavigate={navTo} />}
        {view === "recommendations" && <RecommendationsView recommendations={visibleRecommendations} pending={pending} onApprove={(id) => updateRecommendation(id, "Approved", "Approved", "Validated by reviewer in staging", "green")} onReject={(id) => updateRecommendation(id, "Rejected", "Rejected", "Decision recorded by reviewer", "red")} onApply={(id) => updateRecommendation(id, "Applied", "Applied", "Approved change applied to the prototype scenario", "lime")} onRollback={(id) => updateRecommendation(id, "Rolled back", "Rolled back", "Applied change reverted to the previously approved state", "blue")} onOverride={setOverrideId} onNavigate={navTo} />}
        {view === "experiment" && <ExperimentView optimisedApplied={optimisedApplied} analysis={liveAnalysis} onRunDemo={runDemo} />}
        {view === "audit" && <AuditView audit={audit} search={search} />}
        {view === "settings" && <SettingsView settings={settings} setSettings={setSettings} onSave={(label) => {
  pushAudit("Threshold updated", "CONFIG", label, "blue");
  settingsMutation.mutate({
    queueThreshold: settings.queue,
    slowTaskMultiplier: settings.slow,
    cacheMissRate: settings.cache,
    agentUtilisation: settings.agent,
    parallelisationImprovement: settings.parallel,
    highImpactSeconds: settings.impact,
  });
}} />}
      </div>
    </main>

    {demoRunning && <div className="demo-overlay"><div className="demo-modal"><div className="demo-modal-top"><div><div className="eyebrow">Guided walkthrough</div><h2>Running the optimisation loop</h2><p>Replaying the evidence → review → measure story against the validated dataset.</p></div><button className="icon-button" onClick={() => setDemoRunning(false)}><X size={16} /></button></div><div className="demo-steps">{["Baseline metrics", "Bottleneck detection", "Evidence inspection", "Review + apply", "Improved KPI"].map((label, index) => <div className={cn("demo-step", demoStep >= index + 1 && "step-done", demoStep === index && "step-current")} key={label}><span>{demoStep >= index + 1 ? <Check size={13} /> : index + 1}</span><div><strong>{label}</strong><small>{demoStep >= index + 1 ? "Complete" : demoStep === index ? "In progress" : "Queued"}</small></div>{demoStep >= index + 1 && <CheckCircle2 size={15} />}</div>)}</div><div className="demo-progress"><span style={{ width: `${demoStep * 20}%` }} /></div></div></div>}

    {currentOverride && <div className="demo-overlay"><div className="override-modal"><div className="eyebrow">Manual override · {currentOverride.id}</div><h2>Change the recommendation decision</h2><p>Overrides never disappear. Add a concise reason for the immutable audit trail.</p><div className="override-original"><span>Original</span><strong>{currentOverride.severity} · {currentOverride.title}</strong><small>{currentOverride.proposed}</small></div><label>Override reason<textarea autoFocus value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} placeholder="e.g. Task B shares a staging resource..." /></label><div className="modal-actions"><button className="ghost-button" onClick={() => setOverrideId(null)}>Cancel</button><button className="primary-button" onClick={saveOverride}><ShieldCheck size={14} /> Save override</button></div></div></div>}
  </div>;
}

function OverviewView({ optimisedApplied, analysis, onRunDemo, onRefresh, onNavigate }: { optimisedApplied: boolean; analysis: any; onRunDemo: () => void; onRefresh: () => void; onNavigate: (view: ViewKey) => void }) {
  return <>
    <div className="hero-strip"><div><div className="eyebrow lime">Live workspace · Dataset v2.2</div><h1>Make CI feedback <em>faster.</em></h1><p>Evidence-backed signals for the build work slowing your team down.</p><div className="hero-actions"><button className="primary-button" onClick={onRunDemo}><Play size={14} fill="currentColor" /> Run demo story</button><button className="secondary-button" onClick={() => onNavigate("recommendations")}><Sparkles size={14} /> Review recommendations <ChevronRight size={14} /></button></div></div><div className="hero-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-core"><span>{analysis ? `${Math.round((1 - analysis.measuredMedianFeedback / analysis.baselineMedianFeedback) * 1000) / 10}%` : "—"}</span><small>faster feedback</small></div><span className="orbit-node node-a"><Zap size={13} /></span><span className="orbit-node node-b"><Database size={13} /></span><span className="orbit-node node-c"><Split size={13} /></span></div></div>
    <div className="content-row intro-row"><div><div className="eyebrow">Primary KPI</div><h2>Developer feedback time</h2><p className="muted-copy">Median request → completion across {analysis?.recordsAnalysed ?? 648} analysed build records.</p></div><div className="experiment-state"><span className={cn("pulse-dot", optimisedApplied ? "pulse-lime" : "pulse-amber")} /> <span>{optimisedApplied ? "Optimised scenario measured" : "Baseline scenario active"}</span><button onClick={() => onNavigate("experiment")}>View experiment <ChevronRight size={14} /></button></div></div>
    <div className="kpi-grid"><KpiCard label="Median feedback" value={`${analysis?.measuredMedianFeedback ?? 9.1}m`} meta={`Baseline ${analysis?.baselineMedianFeedback ?? 14.8}m`} trend={`${analysis ? Math.round((1 - analysis.measuredMedianFeedback / analysis.baselineMedianFeedback) * 1000) / 10 : 38.5}%`} tone="lime" icon={Clock3} /><KpiCard label="Queue time" value={`${analysis?.measuredQueue ?? 2.2}m`} meta={`Baseline ${analysis?.baselineQueue ?? 3.7}m`} trend="↓" tone="amber" icon={ListFilter} /><KpiCard label="Cache hit rate" value={`${analysis?.measuredCacheHitRate ?? 74}%`} meta={`Baseline ${analysis?.baselineCacheHitRate ?? 41}%`} trend="+ pts" tone="blue" icon={HardDrive} /><KpiCard label="Agent utilisation" value={`${analysis?.measuredAgentUtilisation ?? 82}%`} meta={`Baseline ${analysis?.baselineAgentUtilisation ?? 91}%`} trend="↓" tone="violet" icon={Gauge} /></div>
    <div className="dashboard-grid"><div className="panel chart-panel"><div className="panel-header"><div><div className="eyebrow">Feedback trajectory</div><h3>Baseline vs measured</h3></div><div className="legend"><span><i className="legend-line baseline" /> Baseline</span><span><i className="legend-line measured" /> Measured</span></div></div><div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={areaData} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}><defs><linearGradient id="measuredFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b7f35b" stopOpacity={0.22} /><stop offset="100%" stopColor="#b7f35b" stopOpacity={0} /></linearGradient></defs><CartesianGrid stroke="#243241" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="day" tick={{ fill: "#76869a", fontSize: 11 }} axisLine={false} tickLine={false} /><YAxis tick={{ fill: "#76869a", fontSize: 11 }} axisLine={false} tickLine={false} unit="m" /><Tooltip contentStyle={{ background: "#121b25", border: "1px solid #2e4053", borderRadius: 8, color: "#f4f7fb" }} /><Area type="monotone" dataKey="baseline" stroke="#708197" strokeWidth={2} strokeDasharray="5 4" fill="none" /><Area type="monotone" dataKey="measured" stroke="#b7f35b" strokeWidth={2.5} fill="url(#measuredFill)" /></AreaChart></ResponsiveContainer></div><div className="chart-caption"><span>Current window · last 7 days</span><strong><ArrowDownRight size={14} /> 5.7 min saved at median</strong></div></div><div className="panel impact-panel"><div className="panel-header"><div><div className="eyebrow">Where time goes</div><h3>Task contribution</h3></div><button className="icon-button"><MoreHorizontal size={16} /></button></div><div className="donut-wrap"><ResponsiveContainer width="100%" height={165}><PieChart><Pie data={taskData} innerRadius={52} outerRadius={74} paddingAngle={3} dataKey="value" stroke="none">{taskData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}</Pie><Tooltip contentStyle={{ background: "#121b25", border: "1px solid #2e4053", borderRadius: 8, color: "#f4f7fb" }} /></PieChart></ResponsiveContainer><div className="donut-center"><strong>648</strong><span>records</span></div></div><div className="donut-legend">{taskData.map((entry) => <div key={entry.name}><span style={{ background: entry.fill }} />{entry.name}<strong>{entry.value}%</strong></div>)}</div></div></div>
    <div className="dashboard-grid bottom-grid"><div className="panel"><div className="panel-header"><div><div className="eyebrow">Needs a decision</div><h3>Recommendation queue</h3></div><button className="text-button" onClick={() => onNavigate("recommendations")}>View all <ChevronRight size={14} /></button></div><div className="recommendation-list"><MiniRec rec={initialRecommendations[0]} onClick={() => onNavigate("recommendations")} /><MiniRec rec={initialRecommendations[1]} onClick={() => onNavigate("recommendations")} /><MiniRec rec={initialRecommendations[2]} onClick={() => onNavigate("recommendations")} /></div></div><div className="panel"><div className="panel-header"><div><div className="eyebrow">Signal health</div><h3>Analysis coverage</h3></div><StatusPill tone="green">Healthy</StatusPill></div><div className="health-list"><HealthRow label="Data quality" value="96%" progress={96} tone="lime" /><HealthRow label="Evidence coverage" value="91%" progress={91} tone="blue" /><HealthRow label="Dependency graph" value="84%" progress={84} tone="violet" /><HealthRow label="Recommendation accuracy" value="88%" progress={88} tone="amber" /></div><div className="health-foot"><ShieldCheck size={14} /> High-priority signals always include evidence</div></div></div>
  </>;
}

function MiniRec({ rec, onClick }: { rec: typeof initialRecommendations[number]; onClick: () => void }) {
  return <button className="mini-rec" onClick={onClick}><span className={cn("rec-marker", rec.severity === "HIGH" ? "marker-amber" : "marker-blue")}><Sparkles size={13} /></span><div><strong>{rec.title}</strong><span>{rec.type} · {rec.benefit}</span></div><StatusPill tone={rec.status === "Approved" ? "green" : rec.status === "Rejected" ? "red" : "amber"}>{rec.status}</StatusPill><ChevronRight size={15} /></button>;
}

function HealthRow({ label, value, progress, tone }: { label: string; value: string; progress: number; tone: string }) { return <div className="health-row"><div><span>{label}</span><strong>{value}</strong></div><div className="progress-track"><span className={`progress-${tone}`} style={{ width: `${progress}%` }} /></div></div>; }

function BuildsView({ rows, totalRecords, search, filter, setFilter, onUploadLogs, onLoadDemo }: {
  rows: typeof buildRows;
  totalRecords: number;
  search: string;
  filter: string;
  setFilter: (value: string) => void;
  onUploadLogs: (csv: string, format: "csv" | "json") => void;
  onLoadDemo: () => void;
}) {
  return <><SectionHeading eyebrow="Monitor / build explorer" title="Build explorer" description="Browse representative records from the reproducible synthetic validation dataset." action={<div className="header-actions"><label className="upload-button"><UploadCloud size={15} /> Upload logs<input type="file" accept=".csv,.json" onChange={async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const csv = await file.text();
  const format = file.name.toLowerCase().endsWith(".json") ? "json" : "csv";
  onUploadLogs(csv, format);
}} /></label><button className="secondary-button" onClick={onLoadDemo}><RefreshCw size={14} /> Load demo dataset</button></div>} /><div className="filter-bar"><div className="filter-search"><Search size={15} /><input value={search} readOnly placeholder="Search by build, pipeline, branch or agent" /></div><div className="filter-tabs">{["All", "Passed", "Failed", "Retrying"].map((item) => <button key={item} className={filter === item ? "filter-active" : ""} onClick={() => setFilter(item)}>{item}{item === "All" && <span>{totalRecords}</span>}</button>)}</div><button className="icon-button"><Filter size={16} /></button></div><div className="panel table-panel"><div className="table-summary"><span><strong>{rows.length}</strong> visible records</span><span><CircleDot size={12} className="green-dot" /> Feed synced from analysis</span></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Build</th><th>Pipeline / branch</th><th>Duration</th><th>Queue</th><th>Cache hit</th><th>Agent</th><th>Status</th><th /></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><strong>{row.id}</strong><span className="sub-cell"><GitCommitHorizontal size={11} /> {row.commit}</span></td><td><strong>{row.pipeline}</strong><span className="sub-cell"><GitBranch size={11} /> {row.branch}</span></td><td><strong>{row.duration}</strong><span className="sub-cell">completed 4m ago</span></td><td className={row.queue.startsWith("8") ? "text-warn" : ""}>{row.queue}</td><td><span className={cn("cache-value", Number(row.cache.replace("%", "")) < 40 ? "cache-low" : "")}>{row.cache}</span></td><td><span className="agent-cell"><span className="agent-avatar">{row.agent.slice(-2)}</span>{row.agent}</span></td><td><StatusPill tone={row.tone}>{row.status}</StatusPill></td><td><button className="icon-button tiny" onClick={() => toast("Build details", { description: `${row.id} · ${row.pipeline} · ${row.duration}` })}><MoreHorizontal size={15} /></button></td></tr>)}</tbody></table>{rows.length === 0 && <EmptyState icon={Search} title="No builds match" copy="Try a different search or filter." />}</div><div className="table-footer"><span>Showing analysed sample records from <strong>{totalRecords} total</strong></span><button className="text-button" onClick={() => downloadCsv("builds.csv", rows.map(row => ({ build: row.id, pipeline: row.pipeline, branch: row.branch, duration: row.duration, queue: row.queue, cacheHit: row.cache, agent: row.agent, status: row.status }))) }>Export CSV <Download size={14} /></button></div></div></>;
}

function BottlenecksView({ bottlenecks, onRefresh, onNavigate }: { bottlenecks: typeof bottleneckRows; onRefresh: () => void; onNavigate: (view: ViewKey) => void }) {
  const highPriority = bottlenecks.filter(item => item.severity === "HIGH").length;
  const avgConfidence = bottlenecks.length ? Math.round(bottlenecks.reduce((sum, item) => sum + item.confidence, 0) / bottlenecks.length) : 0;
  const potential = bottlenecks.reduce((sum, item) => sum + parseFloat(String(item.impact)), 0).toFixed(1);
  return <><SectionHeading eyebrow="Analyse / ranked signals" title="Bottleneck analysis" description="Deterministic rules rank the work consuming the most developer feedback time." action={<button className="secondary-button" onClick={onRefresh}><RefreshCw size={14} /> Re-run analysis</button>} /><div className="analysis-summary"><div><span className="summary-number">{bottlenecks.length}</span><span>active signals</span></div><div><span className="summary-number lime-text">{highPriority}</span><span>high priority</span></div><div><span className="summary-number">{avgConfidence}%</span><span>avg confidence</span></div><div><span className="summary-number">{potential}m</span><span>potential / build</span></div><div className="summary-note"><AlertTriangle size={15} /><span>High priority recommendations require evidence and reviewer approval.</span></div></div><div className="bottleneck-grid">{bottlenecks.map((item, index) => <div className={cn("panel bottleneck-card", index === 0 && "featured-bottleneck")} key={item.id}><div className="bottleneck-top"><span className={cn("severity-dot", `dot-${item.color}`)} /><StatusPill tone={item.severity === "HIGH" ? "amber" : "blue"}>{item.severity}</StatusPill><span className="bottleneck-id">{item.id}</span><button className="icon-button tiny"><MoreHorizontal size={15} /></button></div><div className="eyebrow code-eyebrow">{item.label}</div><h3>{item.task}</h3><span className="pipeline-line"><GitBranch size={12} /> {item.pipeline}</span><div className="confidence-line"><span>Confidence</span><strong>{item.confidence}%</strong><div className="confidence-bar"><span style={{ width: `${item.confidence}%` }} /></div></div><div className="impact-callout"><span>Estimated impact</span><strong>{item.impact}</strong></div><div className="evidence-list">{item.evidence.map((ev) => <div key={ev}><CheckCircle2 size={13} />{ev}</div>)}</div><div className="action-row"><span><Zap size={13} /> {item.action}</span><button className="text-button" onClick={() => onNavigate("recommendations")}>Review <ChevronRight size={13} /></button></div></div>)}</div><div className="edge-case-strip"><div className="eyebrow">Edge case watch</div><div className="edge-case"><span className="edge-icon amber"><AlertTriangle size={14} /></span><div><strong>Missing cache data</strong><span>Cache analysis unavailable · insufficient evidence · confidence capped at LOW</span></div><StatusPill tone="amber">6 flagged</StatusPill></div><div className="edge-case"><span className="edge-icon red"><Split size={14} /></span><div><strong>Hidden dependency</strong><span>Parallelisation blocked · Task B depends on Task A</span></div><StatusPill tone="red">3 blocked</StatusPill></div><div className="edge-case"><span className="edge-icon violet"><Gauge size={14} /></span><div><strong>Agent saturation</strong><span>Shared runner threshold exceeded · capacity change requires review</span></div><StatusPill tone="violet">Guarded</StatusPill></div></div></>;
}

function RecommendationsView({ recommendations, pending, onApprove, onReject, onApply, onRollback, onOverride, onNavigate }: { recommendations: typeof initialRecommendations; pending: number; onApprove: (id: string) => void; onReject: (id: string) => void; onApply: (id: string) => void; onRollback: (id: string) => void; onOverride: (id: string) => void; onNavigate: (view: ViewKey) => void }) {
  return <><SectionHeading eyebrow="Analyse / decision queue" title="Recommendation center" description="Review evidence-backed changes before they touch a high-impact pipeline configuration." action={<div className="header-actions"><div className="review-count"><span className="pulse-dot pulse-amber" /> {pending} need review</div><button className="secondary-button" onClick={() => onNavigate("audit")}><FileClock size={14} /> Open audit trail</button></div>} /><div className="workflow-strip"><div className="workflow-step done"><span>01</span><div><strong>Detected</strong><small>Rule-based signal</small></div></div><ChevronRight size={14} /><div className="workflow-step active"><span>02</span><div><strong>Pending review</strong><small>Human decision required</small></div></div><ChevronRight size={14} /><div className="workflow-step"><span>03</span><div><strong>Approved / rejected</strong><small>Decision recorded</small></div></div><ChevronRight size={14} /><div className="workflow-step"><span>04</span><div><strong>Applied → validated</strong><small>Measured outcome</small></div></div></div><div className="recommendation-stack">{recommendations.map((rec) => <div className="panel recommendation-card" key={rec.id}><div className="rec-card-main"><div className={cn("rec-icon", rec.severity === "HIGH" ? "rec-icon-amber" : rec.severity === "LOW" ? "rec-icon-blue" : "rec-icon-lime")}><Sparkles size={17} /></div><div className="rec-card-copy"><div className="rec-header-line"><span className="eyebrow code-eyebrow">{rec.type}</span><span className="rec-id">{rec.id}</span></div><h3>{rec.title}</h3><p>{rec.reason}</p><div className="rec-meta"><span><strong>{rec.benefit}</strong> expected benefit</span><span><strong>{rec.confidence}%</strong> confidence</span><span><strong>{rec.risk}</strong> risk</span><span>Owner <strong>{rec.owner}</strong></span></div></div></div><div className="rec-card-side"><StatusPill tone={rec.status === "Approved" ? "green" : rec.status === "Rejected" ? "red" : rec.status === "Overridden" ? "violet" : rec.status === "Applied" ? "blue" : "amber"}>{rec.status}</StatusPill><div className="rec-actions"><button className="icon-button tiny" onClick={() => toast("Evidence panel", { description: rec.evidence.join(" · ") })}><FileText size={14} /></button>{rec.status === "Pending review" && <><button className="small-button button-green" onClick={() => onApprove(rec.id)}><Check size={13} /> Approve</button><button className="small-button button-ghost" onClick={() => onReject(rec.id)}><X size={13} /> Reject</button><button className="small-button button-ghost" onClick={() => onOverride(rec.id)}>Override</button></>}{(rec.status === "Approved" || rec.status === "Overridden") && <button className="small-button button-green" onClick={() => onApply(rec.id)}><Zap size={13} /> Apply</button>}{rec.status === "Applied" && <button className="small-button button-ghost" onClick={() => onRollback(rec.id)}><RotateCcw size={13} /> Rollback</button>}</div></div><div className="rec-expanded"><div><span>Evidence</span>{rec.evidence.slice(0, 3).map((item) => <strong key={item}>{item}</strong>)}</div><div><span>Proposed change</span><strong>{rec.proposed}</strong></div><div><span>Rollback</span><strong>{rec.rollback}</strong></div></div></div>)}</div></>;
}

function ExperimentView({ optimisedApplied, analysis, onRunDemo }: { optimisedApplied: boolean; analysis: any; onRunDemo: () => void }) {
  const improvement = analysis ? Math.round((1 - analysis.measuredMedianFeedback / analysis.baselineMedianFeedback) * 1000) / 10 : 0;
  return <><SectionHeading eyebrow="Validate / baseline experiment" title="Experiment dashboard" description="Baseline vs target vs measured, calculated from the current validated dataset and deterministic approval scenario." action={<button className="primary-button" onClick={onRunDemo}><Play size={14} fill="currentColor" /> Re-run simulation</button>} /><div className="experiment-hero panel"><div><div className="eyebrow lime">Primary KPI · {optimisedApplied ? "Measured result" : "Baseline mode"}</div><h2>How much faster did developers receive feedback?</h2><div className="big-kpi"><span>{analysis?.baselineMedianFeedback ?? 14.8}m</span><ArrowDownRight size={27} /><strong>{optimisedApplied ? `${analysis?.measuredMedianFeedback ?? 9.1}m` : `${analysis?.baselineMedianFeedback ?? 14.8}m`}</strong></div><div className="big-kpi-label"><span>Baseline median</span><span>Measured median</span></div></div><div className="experiment-result"><span className="result-ring">{optimisedApplied ? `${improvement}%` : "—"}</span><div><strong>{optimisedApplied ? "faster developer feedback" : "run the simulation"}</strong><span>{optimisedApplied ? "Approved cache + parallelisation recommendations applied" : "Use the simulation to measure the optimised scenario"}</span></div></div></div><div className="panel" style={{ marginTop: 12, padding: "14px 16px" }}><div className="eyebrow">Metric definition</div><strong>Median feedback = median(durationSec)</strong><p className="muted-copy">{analysis?.formula ?? "durationSec is the end-to-end queue-to-completion interval; queueSec is reported separately and not added twice."}</p></div><div className="panel experiment-evidence" style={{ marginTop: 12, padding: "14px 16px" }}><div className="panel-header"><div><div className="eyebrow">Error analysis</div><h3>Baseline → target → measured</h3></div><StatusPill tone={analysis?.experiment?.errorAnalysis?.targetMet ? "green" : "amber"}>{analysis?.experiment?.errorAnalysis?.targetMet ? "Target met" : "Below target"}</StatusPill></div><div className="experiment-error-grid"><div><span>Baseline</span><strong>{analysis?.baselineMedianFeedback ?? 11.69}m</strong></div><div><span>Target</span><strong>{analysis?.experiment?.targetMedianFeedbackMinutes ?? 9.94}m</strong></div><div><span>Measured</span><strong>{analysis?.measuredMedianFeedback ?? 9.87}m</strong></div><div><span>Reduction</span><strong>{analysis?.experiment?.errorAnalysis?.measuredReductionPct ?? 15.62}%</strong></div><div><span>Target error</span><strong>{analysis?.experiment?.errorAnalysis?.absoluteReductionPctPoints ?? 0.62} pp</strong></div><div><span>Relative error</span><strong>{analysis?.experiment?.errorAnalysis?.relativeTargetErrorPct ?? 4.13}%</strong></div></div><p className="muted-copy">{analysis?.experiment?.errorAnalysis?.interpretation ?? "The measured experiment is compared with the explicit 15% reduction target; all values are calculated from the validated dataset."}</p></div><div className="metric-table panel"><div className="table-summary"><span><strong>Experiment comparison</strong></span><span className="muted-copy">Scenario: approved recommendations only</span></div><table className="data-table"><thead><tr><th>Metric</th><th>Baseline</th><th>Target</th><th>Measured</th><th>Change</th><th>Result</th></tr></thead><tbody><ExperimentRow label="Median feedback time" icon={Clock3} baseline={`${analysis?.baselineMedianFeedback ?? 11.69}m`} target={`<= ${analysis?.experiment?.targetMedianFeedbackMinutes ?? 9.94}m`} measured={optimisedApplied ? `${analysis?.measuredMedianFeedback ?? 9.87}m` : `${analysis?.baselineMedianFeedback ?? 11.69}m`} change={`${analysis ? Math.round((1 - analysis.measuredMedianFeedback / analysis.baselineMedianFeedback) * 1000) / 10 : 38.5}% faster`} pass={optimisedApplied} /><ExperimentRow label="P90 feedback time" icon={Activity} baseline={`${analysis?.baselineP90Feedback ?? 14.83}m`} target="< 20m" measured={optimisedApplied ? `${analysis?.measuredP90Feedback ?? 18.6}m` : `${analysis?.baselineP90Feedback ?? 27.4}m`} change={`${analysis ? Math.round((1 - analysis.measuredP90Feedback / analysis.baselineP90Feedback) * 1000) / 10 : 12.2}% faster`} pass={optimisedApplied} /><ExperimentRow label="Cache hit rate" icon={HardDrive} baseline={`${analysis?.baselineCacheHitRate ?? 63}%`} target="> 70%" measured={optimisedApplied ? `${analysis?.measuredCacheHitRate ?? 74}%` : `${analysis?.baselineCacheHitRate ?? 41}%`} change={`${analysis ? Math.round((analysis.measuredCacheHitRate - analysis.baselineCacheHitRate) * 10) / 10 : 15.4} pts`} pass={optimisedApplied} /><ExperimentRow label="Queue time" icon={ListFilter} baseline={`${analysis?.baselineQueue ?? 3.4}m`} target="< 3m" measured={optimisedApplied ? `${analysis?.measuredQueue ?? 2.2}m` : `${analysis?.baselineQueue ?? 3.7}m`} change={`${analysis ? Math.round((1 - analysis.measuredQueue / analysis.baselineQueue) * 1000) / 10 : 22}% lower`} pass={optimisedApplied} /><ExperimentRow label="Agent utilisation" icon={Gauge} baseline={`${analysis?.baselineAgentUtilisation ?? 75.77}%`} target="< 85%" measured={optimisedApplied ? `${analysis?.measuredAgentUtilisation ?? 82}%` : `${analysis?.baselineAgentUtilisation ?? 91}%`} change={`${analysis ? Math.round((analysis.measuredAgentUtilisation - analysis.baselineAgentUtilisation) * 10) / 10 : -7.6} pts`} pass={optimisedApplied} /></tbody></table></div><div className="dashboard-grid experiment-bottom"><div className="panel"><div className="panel-header"><div><div className="eyebrow">Model quality</div><h3>False-positive / false-negative analysis</h3></div><StatusPill tone="green">F1 {analysis?.quality?.f1 ?? 0.88}</StatusPill></div><div className="confusion-grid"><div><span>True positives</span><strong>{analysis?.quality?.tp ?? 28}</strong></div><div><span>False positives</span><strong className="amber-text">{analysis?.quality?.fp ?? 4}</strong></div><div><span>True negatives</span><strong>{analysis?.quality?.tn ?? 49}</strong></div><div><span>False negatives</span><strong className="red-text">{analysis?.quality?.fn ?? 3}</strong></div></div><div className="precision-row"><div><span>Precision</span><strong>{analysis?.quality?.precision ?? 87.5}%</strong><div className="progress-track"><span className="progress-lime" style={{ width: `${analysis?.quality?.precision ?? 87.5}%` }} /></div></div><div><span>Recall</span><strong>{analysis?.quality?.recall ?? 90.3}%</strong><div className="progress-track"><span className="progress-blue" style={{ width: `${analysis?.quality?.recall ?? 90.3}%` }} /></div></div></div></div><div className="panel"><div className="panel-header"><div><div className="eyebrow">Validation pulse</div><h3>Stakeholder feedback</h3></div><StatusPill tone="violet">Simulated</StatusPill></div><div className="rating-row"><span>Recommendation clarity</span><strong>4.6 <small>/ 5</small></strong></div><div className="rating-row"><span>Evidence usefulness</span><strong>4.4 <small>/ 5</small></strong></div><div className="rating-row"><span>Trust in recommendation</span><strong>4.2 <small>/ 5</small></strong></div><div className="rating-row"><span>Ease of override</span><strong>4.7 <small>/ 5</small></strong></div><p className="simulated-note"><Users size={13} /> Simulated stakeholder validation · no real production feedback</p></div></div></>;
}

function ExperimentRow({ label, icon: Icon, baseline, target, measured, change, pass }: { label: string; icon: typeof Activity; baseline: string; target: string; measured: string; change: string; pass: boolean }) { return <tr><td><span className="metric-label"><Icon size={14} /> {label}</span></td><td>{baseline}</td><td className="muted-cell">{target}</td><td><strong className={pass ? "lime-text" : ""}>{measured}</strong></td><td className={pass ? "lime-text" : "muted-cell"}>{pass ? change : "—"}</td><td>{pass ? <StatusPill tone="green"><Check size={12} /> Pass</StatusPill> : <StatusPill tone="amber">Pending</StatusPill>}</td></tr>; }

function AuditView({ audit, search }: { audit: typeof auditSeed; search: string }) {
  const filtered = audit.filter((item) => [item.user, item.action, item.rec, item.detail].join(" ").toLowerCase().includes(search.toLowerCase()));
  return <><SectionHeading eyebrow="Validate / immutable decisions" title="Audit trail" description="Every recommendation decision, override, threshold change, and rollback state transition is recorded with version context." action={<div className="header-actions"><button className="secondary-button" onClick={() => downloadCsv("audit-trail.csv", audit.map(item => ({ time: item.time, user: item.user, action: item.action, recommendationId: item.rec, detail: item.detail })))}><Download size={14} /> Export log</button><button className="icon-button"><Filter size={16} /></button></div>} /><div className="audit-banner"><ShieldCheck size={18} /><div><strong>Versioned audit history enabled</strong><span>Evidence v2.2 · Versioned configuration · append-only decision events</span></div><StatusPill tone="green">Verified</StatusPill></div><div className="audit-layout"><div className="panel audit-panel"><div className="table-summary"><span><strong>{filtered.length}</strong> events</span><span>Newest first</span></div><div className="audit-list">{filtered.map((item, index) => <div className="audit-item" key={`${item.rec}-${index}`}><div className={cn("audit-dot", `audit-${item.tone}`)}>{item.action === "Approved" ? <Check size={13} /> : item.action === "Rejected" ? <X size={13} /> : item.action === "Override" ? <Settings2 size={13} /> : item.action === "Applied" ? <Zap size={13} /> : <CircleDot size={12} />}</div><div className="audit-main"><div><strong>{item.action}</strong><span className="audit-rec">{item.rec}</span></div><p>{item.detail}</p><span className="audit-by">{item.user} · {item.time}</span></div><ChevronRight size={15} className="audit-chevron" /></div>)}</div></div><div className="panel version-panel"><div className="eyebrow">Change context</div><h3>Versions in scope</h3><div className="version-row"><span>Dataset</span><strong>v1.4</strong><small>648 records</small></div><div className="version-row"><span>Ruleset</span><strong>v2.2</strong><small>6 thresholds</small></div><div className="version-row"><span>Config</span><strong>v1.5</strong><small>updated 18m ago</small></div><div className="version-row"><span>Reviewer</span><strong>5</strong><small>decisions today</small></div><div className="rollback-card"><RotateCcw size={15} /><div><strong>Rollback ready</strong><span>Applied recommendations can be restored to the state recorded before application; the rollback action is itself audited.</span></div><StatusPill tone="blue">Governed</StatusPill></div></div></div></>;
}

function SettingsView({ settings, setSettings, onSave }: { settings: { queue: number; slow: number; cache: number; agent: number; parallel: number; impact: number }; setSettings: Dispatch<SetStateAction<{ queue: number; slow: number; cache: number; agent: number; parallel: number; impact: number }>>; onSave: (label: string) => void }) {
  const fields = [{ key: "queue", label: "Queue bottleneck", suffix: "%", helper: "Flag when median queue exceeds this share of total pipeline time." }, { key: "slow", label: "Slow task multiplier", suffix: "×", helper: "Flag tasks above this multiple of the pipeline task median." }, { key: "cache", label: "Cache miss rate", suffix: "%", helper: "Flag cache opportunities above this miss-rate threshold." }, { key: "agent", label: "Agent utilisation", suffix: "%", helper: "Flag saturated agents above this utilisation threshold." }, { key: "parallel", label: "Parallelisation minimum", suffix: "%", helper: "Minimum expected pipeline improvement to create a signal." }, { key: "impact", label: "High-impact threshold", suffix: "s", helper: "Changes above this expected saving require manual review." }] as const;
  return <><SectionHeading eyebrow="Configure / ruleset v2.2" title="Analysis thresholds" description="Tune deterministic detection rules. Every change creates a versioned audit event." action={<button className="primary-button" onClick={() => onSave("All threshold values updated") }><Check size={14} /> Save configuration</button>} /><div className="settings-layout"><div className="panel settings-panel"><div className="panel-header"><div><div className="eyebrow">Detection rules</div><h3>Signal sensitivity</h3></div><StatusPill tone="blue">Versioned config</StatusPill></div><div className="settings-grid">{fields.map((field) => <label className="setting-field" key={field.key}><div><span>{field.label}</span><strong>{settings[field.key]}{field.suffix}</strong></div><input type="range" min={field.key === "slow" ? 1 : 5} max={field.key === "slow" ? 3 : field.key === "cache" ? 90 : 100} step={field.key === "slow" ? 0.1 : 1} value={settings[field.key]} onChange={(event) => setSettings((current) => ({ ...current, [field.key]: Number(event.target.value) }))} /><small>{field.helper}</small></label>)}</div></div><div className="panel methodology-panel"><div className="eyebrow">How this works</div><h3>Evidence before action</h3><p>CI / Signal uses deterministic rules, not a black-box optimiser. Recommendations gain confidence with consistent historical samples and lose confidence when dependency or cache data is incomplete.</p><div className="method-item"><span className="method-number">01</span><div><strong>Validate</strong><span>Reject duplicates, negative durations, and malformed timestamps when timestamp fields are supplied.</span></div></div><div className="method-item"><span className="method-number">02</span><div><strong>Rank</strong><span>Score contribution to total pipeline time, queue share, and agent pressure.</span></div></div><div className="method-item"><span className="method-number">03</span><div><strong>Review</strong><span>High-impact changes never become applied without a human decision.</span></div></div><div className="method-item"><span className="method-number">04</span><div><strong>Measure</strong><span>Compare baseline, target, and measured output in the experiment view.</span></div></div></div></div><div className="limitations-card"><BookOpen size={16} /><div><strong>Prototype limitations</strong><span>Synthetic dataset · rule-based engine · no live GitHub Actions / GitLab / Jenkins integration · hidden dependencies may create false positives.</span></div><button className="text-button" onClick={() => toast("Limitations report", { description: "10 known limitations documented for stakeholder review." })}>Read report <ChevronRight size={14} /></button></div></>;
}
