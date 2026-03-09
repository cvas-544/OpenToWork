import { useState, useEffect, useRef, createContext, useContext } from "react";
import { fetchJobs, fetchStats, fetchProfile, updateSkills } from "./api";
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from "recharts";

// ─── Data Context ─────────────────────────────────────────────────────────────
const DataCtx = createContext(null);
const useData = () => useContext(DataCtx);

// ─── Design Tokens ────────────────────────────────────────────────────────────
const T = {
  orange: "#E8621A",
  orangeLight: "#F5884A",
  orangeXLight: "#FEF0E8",
  black: "#0D0D0D",
  navy: "#1A1A2E",
  gray900: "#1C1C1C",
  gray600: "#5A5A5A",
  gray400: "#9A9A9A",
  gray200: "#E8E8E8",
  gray100: "#F4F4F2",
  white: "#FFFFFF",
  green: "#1A9E6B",
  greenLight: "#E6F7F1",
  amber: "#D97706",
  amberLight: "#FEF3C7",
  red: "#DC2626",
  redLight: "#FEF2F2",
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const jobsData = [
  { id: 1, title: "AI Engineer", company: "Allianz", location: "Munich", score: 94, status: "new", remote: false, lat: 48.13, lng: 11.58, missing: ["Terraform"], matched: ["Python","Claude API","AWS"], date: "Today" },
  { id: 2, title: "ML Ops Engineer", company: "MAN", location: "Munich", score: 87, status: "applied", remote: false, lat: 48.15, lng: 11.60, missing: ["Kubernetes"], matched: ["Docker","PostgreSQL","Python"], date: "Today" },
  { id: 3, title: "Python Developer", company: "BMW Group", location: "Munich", score: 81, status: "interview", remote: false, lat: 48.17, lng: 11.55, missing: ["FastAPI"], matched: ["Python","AWS","Git"], date: "Yesterday" },
  { id: 4, title: "Data Engineer", company: "Siemens", location: "Remote", score: 76, status: "new", remote: true, missing: ["Spark","Kafka"], matched: ["Python","PostgreSQL"], date: "Yesterday" },
  { id: 5, title: "AI Product Manager", company: "N26", location: "Berlin", score: 72, status: "rejected", remote: false, lat: 52.52, lng: 13.40, missing: ["Product Roadmap"], matched: ["AI","Claude API"], date: "Mar 6" },
  { id: 6, title: "LLM Engineer", company: "HuggingFace", location: "Remote", score: 88, status: "new", remote: true, missing: ["LoRA","RLHF"], matched: ["Python","Transformers","Claude API"], date: "Today" },
];

const trendData = [
  { day: "Mon", jobs: 8 }, { day: "Tue", jobs: 14 }, { day: "Wed", jobs: 11 },
  { day: "Thu", jobs: 19 }, { day: "Fri", jobs: 23 }, { day: "Sat", jobs: 7 }, { day: "Sun", jobs: 16 },
];

const gapData = [
  { skill: "Kubernetes", count: 8 }, { skill: "Terraform", count: 6 },
  { skill: "LangChain", count: 5 }, { skill: "Spark", count: 4 },
  { skill: "FastAPI", count: 4 }, { skill: "LoRA", count: 3 },
];

const radarData = [
  { subject: "Python", you: 90, market: 95 },
  { subject: "AWS", you: 70, market: 80 },
  { subject: "Claude", you: 85, market: 60 },
  { subject: "Docker", you: 65, market: 75 },
  { subject: "Postgres", you: 80, market: 70 },
  { subject: "K8s", you: 20, market: 85 },
];

const projects = [
  { id: 1, name: "FinSense AI", skills: ["Python","PostgreSQL","Claude API","AWS"], pct: 70, status: "active", start: 0, end: 75 },
  { id: 2, name: "RAG Chatbot", skills: ["Python","Vector DB","React"], pct: 35, status: "active", start: 30, end: 80 },
  { id: 3, name: "Chrome Extension", skills: ["JavaScript","Chrome API"], pct: 50, status: "paused", start: 50, end: 90 },
  { id: 4, name: "OpenToWork", skills: ["n8n","Claude API","React"], pct: 15, status: "active", start: 60, end: 100 },
];

const interviewPrep = [
  { id: 1, company: "Allianz", role: "AI Engineer", score: 94, questions: 10, practiced: 3, generated: "Today" },
  { id: 2, company: "HuggingFace", role: "LLM Engineer", score: 88, questions: 10, practiced: 0, generated: "Today" },
  { id: 3, company: "BMW Group", role: "Python Developer", score: 81, questions: 8, practiced: 7, generated: "Yesterday" },
];

const starQuestions = [
  { q: "Describe designing a multi-agent system at scale.", difficulty: "Hard", practiced: true },
  { q: "How do you handle LLM hallucinations in production?", difficulty: "Medium", practiced: true },
  { q: "Walk me through your experience with RAG pipelines.", difficulty: "Medium", practiced: false },
  { q: "Explain your approach to prompt engineering.", difficulty: "Easy", practiced: false },
  { q: "How would you migrate a monolith to microservices?", difficulty: "Hard", practiced: false },
];

const pipeline = [
  { stage: "Found", count: 98 },
  { stage: "Saved", count: 24 },
  { stage: "Applied", count: 11 },
  { stage: "Interview", count: 3 },
  { stage: "Offer", count: 0 },
];

const agents = [
  { name: "Job Scraper", status: "done", time: "8:02am", detail: "23 new jobs" },
  { name: "CV Matcher", status: "done", time: "8:04am", detail: "6 matches ≥80%" },
  { name: "Gap Analyst", status: "done", time: "8:06am", detail: "Kubernetes #1 gap" },
  { name: "Interview Coach", status: "running", time: "8:08am", detail: "Generating..." },
  { name: "Reporter", status: "waiting", time: "—", detail: "Pending" },
  { name: "App Tracker", status: "idle", time: "—", detail: "No updates" },
];

const navItems = [
  { id: "overview", label: "Overview", icon: "○" },
  { id: "jobs", label: "Jobs Board", icon: "◈" },
  { id: "map", label: "Map View", icon: "◎" },
  { id: "gaps", label: "Skill Gaps", icon: "△" },
  { id: "timeline", label: "Timeline", icon: "▭" },
  { id: "interview", label: "Interview Prep", icon: "◇" },
  { id: "analytics", label: "Analytics", icon: "◉" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const scoreColor = (s) => s >= 80 ? T.green : s >= 60 ? T.amber : T.red;
const scoreBg = (s) => s >= 80 ? T.greenLight : s >= 60 ? T.amberLight : T.redLight;
const scoreLabel = (s) => s >= 80 ? "Strong" : s >= 60 ? "Good" : "Weak";
const statusStyle = {
  new: { bg: "#EEF2FF", color: "#4338CA" },
  applied: { bg: T.orangeXLight, color: T.orange },
  interview: { bg: T.amberLight, color: T.amber },
  rejected: { bg: T.redLight, color: T.red },
  offer: { bg: T.greenLight, color: T.green },
};

// ─── Glass Card ───────────────────────────────────────────────────────────────
const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{
    background: "rgba(255,255,255,0.72)",
    backdropFilter: "blur(20px) saturate(160%)",
    WebkitBackdropFilter: "blur(20px) saturate(160%)",
    border: "1px solid rgba(255,255,255,0.9)",
    borderRadius: 18,
    boxShadow: "0 2px 16px rgba(0,0,0,0.06), 0 1px 4px rgba(0,0,0,0.04)",
    transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
    ...style,
  }}>
    {children}
  </div>
);

const Label = ({ children, style = {} }) => (
  <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: T.gray400, marginBottom: 12, ...style }}>
    {children}
  </div>
);

const Tag = ({ children, color, bg }) => (
  <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", padding: "3px 9px", borderRadius: 99, background: bg || T.gray100, color: color || T.gray600 }}>
    {children}
  </span>
);

// ─── Overview ─────────────────────────────────────────────────────────────────
const Overview = () => {
  const { jobs, trendData: trend, pipeline: pipe, stats } = useData();
  return (
  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
    {/* Hero stat row */}
    <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 14 }}>
      {/* Big orange hero card */}
      <Card style={{ padding: "28px 32px", background: T.orange, border: "none", boxShadow: "0 8px 32px rgba(232,98,26,0.3)" }}>
        <Label style={{ color: "rgba(255,255,255,0.8)", marginBottom: 8 }}>Today's Run</Label>
        <div style={{ fontFamily: "'Bebas Neue', 'Anton', sans-serif", fontSize: 72, lineHeight: 0.9, color: "#fff", letterSpacing: "-0.01em" }}>{stats.today}</div>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 13, color: "rgba(255,255,255,0.8)", marginTop: 8 }}>New jobs found</div>
        <div style={{ marginTop: 16, fontSize: 11, fontFamily: "'DM Mono', monospace", color: "rgba(255,255,255,0.6)", display: "flex", gap: 16 }}>
          <span>{jobs.filter(j => j.score >= 80).length} top matches</span>
          <span>·</span>
          <span>Live data</span>
        </div>
      </Card>
      {[
        { label: "Applied", value: String(stats.applied), sub: "tracked" },
        { label: "Interviews", value: String(stats.interviews), sub: "scheduled" },
        { label: "Total Found", value: String(stats.total), sub: "all time" },
      ].map(s => (
        <Card key={s.label} style={{ padding: "24px 28px" }}>
          <Label>{s.label}</Label>
          <div style={{ fontFamily: "'Bebas Neue', 'Anton', sans-serif", fontSize: 52, lineHeight: 1, color: T.black, letterSpacing: "-0.01em" }}>{s.value}</div>
          <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray400, marginTop: 6 }}>{s.sub}</div>
        </Card>
      ))}
    </div>

    {/* Charts row */}
    <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 14 }}>
      {/* Trend chart */}
      <Card style={{ padding: "24px 28px" }}>
        <Label>Daily Jobs Found — This Week</Label>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="og" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={T.orange} stopOpacity={0.15} />
                <stop offset="95%" stopColor={T.orange} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fill: T.gray400, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${T.gray200}`, borderRadius: 12, fontSize: 11, color: T.black, fontFamily: "DM Mono", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }} />
            <Area type="monotone" dataKey="jobs" stroke={T.orange} fill="url(#og)" strokeWidth={2.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {/* Pipeline */}
      <Card style={{ padding: "24px 28px" }}>
        <Label>Application Pipeline</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pipe.map((p, i) => (
            <div key={p.stage} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 64, fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray600 }}>{p.stage}</div>
              <div style={{ flex: 1, height: 6, background: T.gray100, borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${(p.count / 98) * 100}%`, height: "100%", background: i === 0 ? T.gray400 : T.orange, borderRadius: 99, transition: "width 1s ease" }} />
              </div>
              <div style={{ width: 24, textAlign: "right", fontSize: 12, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: T.black }}>{p.count}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Agent status */}
      <Card style={{ padding: "24px 28px" }}>
        <Label>Agent Status</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {agents.map(a => (
            <div key={a.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                background: a.status === "done" ? T.green : a.status === "running" ? T.orange : T.gray300,
                boxShadow: a.status === "running" ? `0 0 0 3px ${T.orangeXLight}` : "none",
                animation: a.status === "running" ? "pulse 1.5s infinite" : "none",
              }} />
              <div style={{ flex: 1, fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray600 }}>{a.name}</div>
              <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: T.gray400 }}>{a.time}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>

    {/* Top Matches */}
    <Card style={{ padding: "24px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Label>Today's Top Matches</Label>
        <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.orange, cursor: "pointer" }}>View all →</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {jobs.filter(j => j.score >= 80).slice(0, 3).map(j => (
          <div key={j.id} style={{ padding: "16px", background: T.gray100, borderRadius: 14, border: `1px solid ${T.gray200}`, cursor: "pointer", transition: "all 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.orange; e.currentTarget.style.background = T.orangeXLight; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.gray200; e.currentTarget.style.background = T.gray100; }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontFamily: "'Bebas Neue', 'Anton', sans-serif", fontSize: 40, lineHeight: 1, color: scoreColor(j.score), letterSpacing: "-0.01em" }}>{j.score}<span style={{ fontSize: 20 }}>%</span></div>
              <Tag color={scoreColor(j.score)} bg={scoreBg(j.score)}>{scoreLabel(j.score)}</Tag>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: T.black, marginBottom: 2, fontFamily: "'Sora', sans-serif" }}>{j.title}</div>
            <div style={{ fontSize: 11, color: T.gray400, marginBottom: 10, fontFamily: "'DM Mono', monospace" }}>{j.company} · {j.location}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {(j.matched || []).slice(0, 2).map(s => <Tag key={s} color={T.green} bg={T.greenLight}>✓ {s}</Tag>)}
              {(j.missing || []).map(s => <Tag key={s} color={T.red} bg={T.redLight}>✗ {s}</Tag>)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  </div>
  );
};

// ─── Jobs Board ───────────────────────────────────────────────────────────────
const JobsBoard = () => {
  const { jobs } = useData();
  const [selected, setSelected] = useState(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");

  const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const cutoff = (days) => { const d = new Date(); d.setDate(d.getDate() - days); return d; };

  const locationOptions = ["All locations", "Remote only", ...Array.from(new Set(jobs.map(j => j.location).filter(Boolean))).sort()];

  const filtered = jobs.filter(j => {
    if (locationFilter === "Remote only") { if (!j.remote) return false; }
    else if (locationFilter && locationFilter !== "All locations") {
      if (!j.location?.toLowerCase().includes(locationFilter.toLowerCase())) return false;
    }
    const ref = j.date_posted ? new Date(j.date_posted) : null;
    if (dateRange === "today") {
      if (!ref || isNaN(ref) || ref < today()) return false;
    } else if (dateRange === "3") {
      if (!ref || isNaN(ref) || ref < cutoff(3)) return false;
    } else if (dateRange === "7") {
      if (!ref || isNaN(ref) || ref < cutoff(7)) return false;
    } else if (dateRange === "10") {
      if (!ref || isNaN(ref) || ref < cutoff(10)) return false;
    } else if (dateRange === "10-30") {
      if (!ref || isNaN(ref) || ref >= cutoff(10) || ref < cutoff(30)) return false;
    }
    const score = j.score ?? null;
    if (scoreFilter === "80") { if (!score || score < 80) return false; }
    else if (scoreFilter === "60") { if (!score || score < 60 || score >= 80) return false; }
    else if (scoreFilter === "scored") { if (!score) return false; }
    else if (scoreFilter === "unscored") { if (score) return false; }
    return true;
  }).sort((a, b) => {
    const aD = new Date(a.date_posted || 0);
    const bD = new Date(b.date_posted || 0);
    return sortOrder === "newest" ? bD - aD : aD - bD;
  });

  const fmtDate = (str) => {
    if (!str) return "—";
    const d = new Date(str);
    return isNaN(d) ? str.slice(0, 10) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  const [detailWidth, setDetailWidth] = useState(() => Math.floor((window.innerWidth - 180) * 0.38));
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    const onMove = (e) => {
      if (!isResizing.current) return;
      const dx = startX.current - e.clientX;
      setDetailWidth(Math.min(Math.max(startWidth.current + dx, 280), 800));
    };
    const onUp = () => { isResizing.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const Pill = ({ label, active, onClick }) => (
    <button onClick={onClick} style={{
      fontSize: 10, padding: "5px 12px", borderRadius: 99, cursor: "pointer",
      fontFamily: "'DM Mono', monospace", transition: "all 0.2s",
      background: active ? T.orange : T.gray100,
      border: `1px solid ${active ? T.orange : T.gray200}`,
      color: active ? "#fff" : T.gray600,
    }}>{label}</button>
  );

  const Sep = () => <div style={{ width: 1, height: 18, background: T.gray200, flexShrink: 0 }} />;

  return (
    <div style={{ display: "flex", gap: 14, height: "calc(100vh - 140px)" }}>
      <Card style={{ flex: 1, padding: "24px", overflow: "auto" }}>
        {/* Single filter row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={locationFilter || "All locations"}
            onChange={e => setLocationFilter(e.target.value === "All locations" ? "" : e.target.value)}
            style={{
              fontSize: 11, padding: "5px 12px", borderRadius: 99,
              fontFamily: "'DM Mono', monospace", outline: "none",
              border: `1px solid ${locationFilter && locationFilter !== "All locations" ? T.orange : T.gray200}`,
              background: locationFilter && locationFilter !== "All locations" ? T.orangeXLight : T.gray100,
              color: T.black, cursor: "pointer",
            }}
          >
            {locationOptions.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
          <Sep />
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            style={{
              fontSize: 11, padding: "5px 12px", borderRadius: 99,
              fontFamily: "'DM Mono', monospace", outline: "none",
              border: `1px solid ${dateRange !== "all" ? T.orange : T.gray200}`,
              background: dateRange !== "all" ? T.orangeXLight : T.gray100,
              color: T.black, cursor: "pointer",
            }}
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="3">Last 3 days</option>
            <option value="7">Last 7 days</option>
            <option value="10">Last 10 days</option>
            <option value="10-30">10–30 days ago</option>
          </select>
          <Sep />
          <select
            value={scoreFilter}
            onChange={e => setScoreFilter(e.target.value)}
            style={{
              fontSize: 11, padding: "5px 12px", borderRadius: 99,
              fontFamily: "'DM Mono', monospace", outline: "none",
              border: `1px solid ${scoreFilter !== "all" ? T.orange : T.gray200}`,
              background: scoreFilter !== "all" ? T.orangeXLight : T.gray100,
              color: T.black, cursor: "pointer",
            }}
          >
            <option value="all">All scores</option>
            <option value="80">80+ Green</option>
            <option value="60">60–79 Yellow</option>
            <option value="scored">Scored only</option>
            <option value="unscored">Unscored</option>
          </select>
          <Sep />
          <Pill label="Newest" active={sortOrder === "newest"} onClick={() => setSortOrder("newest")} />
          <Pill label="Oldest" active={sortOrder === "oldest"} onClick={() => setSortOrder("oldest")} />
          <span style={{ marginLeft: "auto", fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray400, flexShrink: 0 }}>{filtered.length} jobs</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map(j => (
            <div key={j.id} onClick={() => setSelected(j)} style={{
              display: "flex", alignItems: "center", gap: 16, padding: "14px 18px",
              borderRadius: 14, cursor: "pointer",
              background: selected?.id === j.id ? T.orangeXLight : T.gray100,
              border: `1px solid ${selected?.id === j.id ? T.orange : T.gray200}`,
              transition: "all 0.2s",
            }}
              onMouseEnter={e => { if (selected?.id !== j.id) { e.currentTarget.style.borderColor = T.gray400; } }}
              onMouseLeave={e => { if (selected?.id !== j.id) { e.currentTarget.style.borderColor = T.gray200; } }}
            >
              <div style={{ fontFamily: "'Bebas Neue', 'Anton', sans-serif", fontSize: 32, lineHeight: 1, color: scoreColor(j.score), width: 56, letterSpacing: "-0.01em" }}>{j.score}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif" }}>{j.title}</div>
                <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>{j.company} · {j.location}</div>
              </div>
              <Tag color={statusStyle[j.status]?.color} bg={statusStyle[j.status]?.bg}>{j.status}</Tag>
              <div style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono', monospace", width: 60, textAlign: "right" }}>{fmtDate(j.date_posted)}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Side detail — always visible */}
      <div style={{ position: "relative", width: detailWidth, flexShrink: 0 }}>
        {/* Resize handle */}
        <div
          onMouseDown={(e) => { isResizing.current = true; startX.current = e.clientX; startWidth.current = detailWidth; e.preventDefault(); }}
          style={{ position: "absolute", left: -4, top: 0, bottom: 0, width: 8, cursor: "col-resize", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div style={{ width: 3, height: 32, borderRadius: 99, background: T.gray200 }} />
        </div>
        <Card style={{ width: "100%", height: "100%", padding: 0, overflow: "hidden", boxSizing: "border-box" }}>
        {!selected ? (
          <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
            <div style={{ fontSize: 32, color: T.gray200 }}>◈</div>
            <div style={{ fontSize: 12, color: T.gray400, fontFamily: "'DM Mono', monospace", textAlign: "center" }}>Select a job<br/>to see details</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "24px", boxSizing: "border-box" }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, flexShrink: 0 }}>
              <div style={{ fontFamily: "'Bebas Neue', 'Anton', sans-serif", fontSize: 64, lineHeight: 1, color: scoreColor(selected.score), letterSpacing: "-0.01em" }}>{selected.score}<span style={{ fontSize: 28 }}>%</span></div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: T.gray400, cursor: "pointer", fontSize: 18, alignSelf: "flex-start" }}>✕</button>
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.black, marginBottom: 2, fontFamily: "'Sora', sans-serif", flexShrink: 0 }}>{selected.title}</div>
            <div style={{ fontSize: 11, color: T.gray400, marginBottom: 16, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>{selected.company} · {selected.location} · {fmtDate(selected.date_posted)}</div>

            {/* Skills */}
            <div style={{ marginBottom: 10, flexShrink: 0 }}>
              <Label>Matched Skills</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(selected.matched || []).map(s => <Tag key={s} color={T.green} bg={T.greenLight}>✓ {s}</Tag>)}
              </div>
            </div>
            <div style={{ marginBottom: 16, flexShrink: 0 }}>
              <Label>Missing Skills</Label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(selected.missing || []).map(s => <Tag key={s} color={T.red} bg={T.redLight}>✗ {s}</Tag>)}
              </div>
            </div>

            {/* Description — grows to fill remaining space */}
            <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", marginBottom: 16 }}>
              <Label>Job Description</Label>
              <div style={{
                flex: 1, minHeight: 0, overflow: "auto", padding: "12px 14px",
                fontSize: 11, color: T.gray600, lineHeight: 1.7, fontFamily: "'Sora', sans-serif",
                background: T.gray100, borderRadius: 10, border: `1px solid ${T.gray200}`,
                whiteSpace: "pre-wrap",
              }}>{selected.description || <span style={{ color: T.gray400 }}>No description available.</span>}</div>
            </div>

            {/* Buttons — pinned to bottom */}
            <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
              <button style={{
                width: "100%", padding: "12px", borderRadius: 12, cursor: "pointer", fontSize: 12, fontWeight: 700,
                background: T.orange, border: "none", color: "#fff", fontFamily: "'DM Mono', monospace",
                boxShadow: `0 4px 16px rgba(232,98,26,0.3)`, transition: "all 0.2s",
              }}>⚡ Generate Interview Prep</button>
              <button
                onClick={() => selected.url && window.open(selected.url, "_blank")}
                style={{
                  width: "100%", padding: "12px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                  fontFamily: "'DM Mono', monospace", transition: "all 0.2s",
                  background: selected.url ? T.black : T.gray100,
                  border: `1px solid ${selected.url ? T.black : T.gray200}`,
                  color: selected.url ? "#fff" : T.gray400,
                  cursor: selected.url ? "pointer" : "not-allowed",
                }}
              >↗ {selected.url ? `Apply on ${selected.source === "serpapi" ? "LinkedIn / Site" : "Arbeitsagentur"}` : "No Apply Link"}</button>
            </div>
          </div>
        )}
        </Card>
      </div>
    </div>
  );
};

// ─── Map View ─────────────────────────────────────────────────────────────────
const MapView = () => {
  const { jobs } = useData();
  const onsite = jobs.filter(j => !j.remote && j.lat);
  const remote = jobs.filter(j => j.remote);
  const toXY = (lat, lng) => ({
    x: ((lng - 5.8) / (15.2 - 5.8)) * 340 + 30,
    y: ((55.2 - lat) / (55.2 - 47.2)) * 260 + 20,
  });

  return (
    <div style={{ display: "flex", gap: 14, height: "calc(100vh - 140px)" }}>
      <Card style={{ flex: 1, padding: "24px", overflow: "hidden" }}>
        <Label>Germany — On-site Job Locations</Label>
        <svg viewBox="0 0 400 310" style={{ width: "100%", maxHeight: 360 }}>
          <path d="M180,20 L220,18 L240,35 L260,30 L280,45 L290,65 L310,80 L320,110 L300,130 L310,155 L295,180 L280,210 L260,240 L240,265 L210,280 L185,270 L165,255 L145,240 L120,225 L100,200 L90,175 L95,150 L80,125 L85,100 L100,80 L120,65 L140,50 L160,35 Z"
            fill="rgba(232,98,26,0.04)" stroke="rgba(232,98,26,0.2)" strokeWidth="1.5" />
          {[{name:"Berlin",lat:52.52,lng:13.4},{name:"Munich",lat:48.13,lng:11.58},{name:"Hamburg",lat:53.55,lng:10.0},{name:"Frankfurt",lat:50.11,lng:8.68}].map(c => {
            const {x, y} = toXY(c.lat, c.lng);
            return <text key={c.name} x={x} y={y+14} fontSize="9" fill={T.gray400} textAnchor="middle" fontFamily="DM Mono">{c.name}</text>;
          })}
          {onsite.map(j => {
            const {x, y} = toXY(j.lat, j.lng);
            return (
              <g key={j.id}>
                <circle cx={x} cy={y} r={18} fill={scoreBg(j.score)} stroke={scoreColor(j.score)} strokeWidth="1.5" opacity="0.7" />
                <circle cx={x} cy={y} r={5} fill={scoreColor(j.score)} />
                <text x={x} y={y-22} fontSize="9" fill={T.gray600} textAnchor="middle" fontFamily="DM Mono">{j.company}</text>
                <text x={x} y={y-12} fontSize="10" fill={scoreColor(j.score)} textAnchor="middle" fontFamily="Bebas Neue,Anton">{j.score}%</text>
              </g>
            );
          })}
        </svg>
        <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
          {[{l:"≥80% Strong",c:T.green,b:T.greenLight},{l:"60–79% Good",c:T.amber,b:T.amberLight},{l:"<60% Weak",c:T.red,b:T.redLight}].map(l => (
            <div key={l.l} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: l.c }} />
              <span style={{ fontSize: 10, color: T.gray500, fontFamily: "'DM Mono', monospace" }}>{l.l}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ width: 280, padding: "24px", flexShrink: 0, overflow: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Label>Remote Jobs</Label>
          <div style={{ marginBottom: 12, marginLeft: 4 }}>
            <Tag color={T.orange} bg={T.orangeXLight}>{remote.length} total</Tag>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {remote.map(j => (
            <div key={j.id} style={{ padding: "14px", background: T.gray100, borderRadius: 14, border: `1px solid ${T.gray200}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontFamily: "'Bebas Neue', 'Anton', sans-serif", fontSize: 36, lineHeight: 1, color: scoreColor(j.score) }}>{j.score}<span style={{ fontSize: 16 }}>%</span></div>
                <Tag color={T.green} bg={T.greenLight}>🌐 Remote</Tag>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif" }}>{j.title}</div>
              <div style={{ fontSize: 11, color: T.gray400, marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>{j.company}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {j.missing.map(s => <Tag key={s} color={T.red} bg={T.redLight}>✗ {s}</Tag>)}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Skill Gaps ───────────────────────────────────────────────────────────────
const SkillGaps = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Card style={{ padding: "24px 28px" }}>
        <Label>Top Skill Gaps by Frequency</Label>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={gapData} layout="vertical">
            <XAxis type="number" tick={{ fill: T.gray400, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} />
            <YAxis dataKey="skill" type="category" tick={{ fill: T.gray600, fontSize: 11, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} width={80} />
            <Tooltip contentStyle={{ background: "#fff", border: `1px solid ${T.gray200}`, borderRadius: 12, fontSize: 11, fontFamily: "DM Mono", boxShadow: "0 4px 16px rgba(0,0,0,0.1)" }} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]}>
              {gapData.map((_, i) => <Cell key={i} fill={i === 0 ? T.orange : `rgba(232,98,26,${0.85 - i * 0.12})`} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card style={{ padding: "24px 28px" }}>
        <Label>Your Skills vs Market Demand</Label>
        <ResponsiveContainer width="100%" height={200}>
          <RadarChart data={radarData}>
            <PolarGrid stroke={T.gray200} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: T.gray600, fontSize: 10, fontFamily: "DM Mono" }} />
            <Radar name="You" dataKey="you" stroke={T.orange} fill={T.orange} fillOpacity={0.15} strokeWidth={2} />
            <Radar name="Market" dataKey="market" stroke={T.gray400} fill={T.gray400} fillOpacity={0.06} strokeDasharray="4 2" />
          </RadarChart>
        </ResponsiveContainer>
      </Card>
    </div>

    <Card style={{ padding: "24px 28px" }}>
      <Label>Gap → Action Suggestions</Label>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {[
          { skill: "Kubernetes", count: 8, action: "Add K8s deployment to FinSense AI", project: "FinSense AI", effort: "~1 week" },
          { skill: "Terraform", count: 6, action: "Terraform course on Udemy", project: null, effort: "~4 hrs" },
          { skill: "LangChain", count: 5, action: "Integrate into RAG Chatbot project", project: "RAG Chatbot", effort: "~3 days" },
        ].map(g => (
          <div key={g.skill} style={{ padding: "18px", background: T.gray100, borderRadius: 14, border: `1px solid ${T.gray200}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
              <div style={{ fontFamily: "'Bebas Neue', 'Anton', sans-serif", fontSize: 28, lineHeight: 1, color: T.black }}>{g.skill}</div>
              <Tag color={T.red} bg={T.redLight}>{g.count} jobs</Tag>
            </div>
            <div style={{ fontSize: 12, color: T.gray600, marginBottom: 10, lineHeight: 1.6, fontFamily: "'Sora', sans-serif" }}>{g.action}</div>
            {g.project && <div style={{ fontSize: 10, color: T.orange, fontFamily: "'DM Mono', monospace" }}>→ {g.project}</div>}
            <div style={{ fontSize: 10, color: T.gray400, marginTop: 4, fontFamily: "'DM Mono', monospace" }}>{g.effort}</div>
          </div>
        ))}
      </div>
    </Card>
  </div>
);

// ─── Timeline ─────────────────────────────────────────────────────────────────
const Timeline = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <Card style={{ padding: "24px 28px" }}>
      <Label>Project Timeline</Label>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        {projects.map(p => (
          <div key={p.id}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif" }}>{p.name}</span>
                <Tag color={p.status === "active" ? T.green : T.amber} bg={p.status === "active" ? T.greenLight : T.amberLight}>{p.status}</Tag>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: T.orange }}>{p.pct}%</span>
            </div>
            <div style={{ position: "relative", height: 28, background: T.gray100, borderRadius: 8, border: `1px solid ${T.gray200}`, overflow: "hidden" }}>
              <div style={{ position: "absolute", left: `${p.start}%`, width: `${p.end - p.start}%`, height: "100%", background: `${T.orange}18`, borderRadius: 6 }} />
              <div style={{ position: "absolute", left: `${p.start}%`, width: `${(p.end - p.start) * (p.pct / 100)}%`, height: "100%", background: T.orange, borderRadius: 6, transition: "width 1s ease" }} />
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
              {p.skills.map(s => <Tag key={s}>{s}</Tag>)}
            </div>
          </div>
        ))}
      </div>
    </Card>

    <Card style={{ padding: "24px 28px" }}>
      <Label>AI Overlay — Smart Skill Mapping</Label>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {[
          { insight: "Adding Kubernetes to FinSense AI deployment closes 8 job gaps", impact: "High", project: "FinSense AI" },
          { insight: "Integrating LangChain into RAG Chatbot covers 5 job listings", impact: "Medium", project: "RAG Chatbot" },
          { insight: "OpenToWork demonstrates n8n + Claude API — 6 job matches", impact: "High", project: "OpenToWork" },
        ].map((ins, i) => (
          <div key={i} style={{ display: "flex", gap: 14, padding: "14px 16px", background: T.gray100, borderRadius: 12, border: `1px solid ${T.gray200}`, alignItems: "flex-start" }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: T.orangeXLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, flexShrink: 0 }}>⚡</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, color: T.gray700, lineHeight: 1.6, fontFamily: "'Sora', sans-serif" }}>{ins.insight}</div>
              <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
                <span style={{ fontSize: 10, color: T.orange, fontFamily: "'DM Mono', monospace" }}>→ {ins.project}</span>
                <Tag color={ins.impact === "High" ? T.green : T.amber} bg={ins.impact === "High" ? T.greenLight : T.amberLight}>{ins.impact} Impact</Tag>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  </div>
);

// ─── Interview Prep ───────────────────────────────────────────────────────────
const InterviewPrepView = () => {
  const [activeJob, setActiveJob] = useState(interviewPrep[0]);
  const diffColors = { Easy: { c: T.green, b: T.greenLight }, Medium: { c: T.amber, b: T.amberLight }, Hard: { c: T.red, b: T.redLight } };

  return (
    <div style={{ display: "flex", gap: 14, height: "calc(100vh - 140px)" }}>
      <Card style={{ width: 240, padding: "20px", flexShrink: 0 }}>
        <Label>Prep Sets</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {interviewPrep.map(ip => (
            <div key={ip.id} onClick={() => setActiveJob(ip)} style={{
              padding: "14px", borderRadius: 12, cursor: "pointer",
              background: activeJob.id === ip.id ? T.orangeXLight : T.gray100,
              border: `1px solid ${activeJob.id === ip.id ? T.orange : T.gray200}`,
              transition: "all 0.2s",
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif" }}>{ip.company}</div>
              <div style={{ fontSize: 10, color: T.gray400, marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>{ip.role}</div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>{ip.practiced}/{ip.questions} done</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(ip.score), fontFamily: "'DM Mono', monospace" }}>{ip.score}%</span>
              </div>
              <div style={{ height: 3, background: T.gray200, borderRadius: 99 }}>
                <div style={{ width: `${(ip.practiced / ip.questions) * 100}%`, height: "100%", background: T.orange, borderRadius: 99 }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ flex: 1, padding: "24px", overflow: "auto" }}>
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: "'Bebas Neue', 'Anton', sans-serif", fontSize: 28, letterSpacing: "-0.01em", color: T.black }}>{activeJob.company} — {activeJob.role}</div>
          <div style={{ fontSize: 11, color: T.gray400, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>Generated {activeJob.generated} · {activeJob.questions} questions</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {starQuestions.map((q, i) => (
            <div key={i} style={{ padding: "16px 20px", background: T.gray100, borderRadius: 14, border: `1px solid ${q.practiced ? T.green + "44" : T.gray200}` }}>
              <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                <Tag color={diffColors[q.difficulty].c} bg={diffColors[q.difficulty].b}>{q.difficulty}</Tag>
                <span style={{ fontSize: 13, color: T.black, lineHeight: 1.5, fontFamily: "'Sora', sans-serif", fontWeight: 600 }}>Q{i+1}. {q.q}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                {["Situation","Task","Action","Result"].map(s => (
                  <div key={s} style={{ padding: "10px 12px", background: "#fff", borderRadius: 10, border: `1px solid ${T.gray200}` }}>
                    <div style={{ fontSize: 9, color: T.orange, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", marginBottom: 4, fontWeight: 700 }}>{s[0]} — {s}</div>
                    <div style={{ fontSize: 10, color: T.gray400, fontFamily: "'Sora', sans-serif" }}>Add your {s.toLowerCase()}...</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
                <Tag color={q.practiced ? T.green : T.gray400} bg={q.practiced ? T.greenLight : T.gray100}>
                  {q.practiced ? "✓ Practiced" : "Mark practiced"}
                </Tag>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Analytics ────────────────────────────────────────────────────────────────
const Analytics = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
      <Card style={{ padding: "24px 28px" }}>
        <Label>Response Rate by Company Type</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 4 }}>
          {[{type:"Startups",rate:42,total:7},{type:"Enterprise",rate:18,total:11},{type:"Scale-ups",rate:33,total:6},{type:"Consulting",rate:0,total:3}].map(r => (
            <div key={r.type} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 80, fontSize: 11, color: T.gray600, fontFamily: "'DM Mono', monospace" }}>{r.type}</div>
              <div style={{ flex: 1, height: 8, background: T.gray100, borderRadius: 99, border: `1px solid ${T.gray200}` }}>
                <div style={{ width: `${r.rate}%`, height: "100%", background: T.orange, borderRadius: 99 }} />
              </div>
              <div style={{ width: 36, textAlign: "right", fontSize: 13, fontWeight: 700, fontFamily: "'DM Mono', monospace", color: T.black }}>{r.rate}%</div>
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ padding: "24px 28px" }}>
        <Label>Salary Intelligence — Munich Market</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}>
          {[{role:"AI Engineer",min:75,max:110},{role:"ML Engineer",min:70,max:100},{role:"Python Dev",min:55,max:85}].map(s => (
            <div key={s.role}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: T.gray600, fontFamily: "'Sora', sans-serif", fontWeight: 600 }}>{s.role}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.orange, fontFamily: "'DM Mono', monospace" }}>€{s.min}k–{s.max}k</span>
              </div>
              <div style={{ height: 8, background: T.gray100, borderRadius: 99, position: "relative", border: `1px solid ${T.gray200}` }}>
                <div style={{ position: "absolute", left: `${(s.min / 120) * 100}%`, width: `${((s.max - s.min) / 120) * 100}%`, height: "100%", background: T.orangeLight, borderRadius: 99, opacity: 0.7 }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>

    <Card style={{ padding: "24px 28px" }}>
      <Label>Rejection Pattern Analyzer</Label>
      <div style={{ padding: "18px 20px", background: T.orangeXLight, borderRadius: 14, border: `1px solid ${T.orange}44` }}>
        <div style={{ fontSize: 13, color: T.gray700, lineHeight: 1.8, fontFamily: "'Sora', sans-serif" }}>
          📊 <strong style={{ color: T.black }}>Pattern detected:</strong> You applied to 5 ML Ops roles — 0 replies. Common missing skill across all: <strong style={{ color: T.orange }}>Kubernetes</strong>.<br />
          💡 <strong style={{ color: T.black }}>Suggested fix:</strong> Add a basic K8s deployment to FinSense AI. This single change could unlock responses from 8 companies in your pipeline.
        </div>
      </div>
    </Card>
  </div>
);

// ─── Profile ──────────────────────────────────────────────────────────────────
const ProfileView = () => {
  const [skills, setSkills] = useState([]);
  const [newSkill, setNewSkill] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetchProfile().then(data => {
      if (data?.skills) setSkills(data.skills);
      setLoaded(true);
    });
  }, []);

  const addSkill = async () => {
    const trimmed = newSkill.trim();
    if (!trimmed || skills.includes(trimmed)) return;
    const updated = [...skills, trimmed];
    setSkills(updated);
    setNewSkill("");
    setSaving(true);
    await updateSkills(updated);
    setSaving(false);
  };

  const removeSkill = async (skill) => {
    const updated = skills.filter(s => s !== skill);
    setSkills(updated);
    await updateSkills(updated);
  };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      {/* Identity card */}
      <Card style={{ padding: "28px 32px", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: T.orangeXLight, border: `2px solid ${T.orange}33`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28,
          }}>👤</div>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: T.black, letterSpacing: "0.02em" }}>Vasu Chukka</div>
            <div style={{ fontSize: 13, color: T.gray600, fontFamily: "'Sora', sans-serif", marginTop: 2 }}>AI / ML Engineer · Munich, Germany</div>
            <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
              Targets: AI Engineer · ML Engineer · Python Developer
            </div>
          </div>
        </div>
      </Card>

      {/* Skills card */}
      <Card style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: T.black, letterSpacing: "0.04em" }}>Skills</div>
            <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>
              Agent 2 uses these for every job match
            </div>
          </div>
          <Tag color={T.green} bg={T.greenLight}>{skills.length} skills</Tag>
        </div>

        {/* Add input */}
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addSkill()}
            placeholder="Add a skill and press Enter..."
            style={{
              flex: 1, padding: "9px 14px", borderRadius: 10,
              border: `1.5px solid ${T.gray200}`, fontSize: 13,
              fontFamily: "'Sora', sans-serif", color: T.black,
              background: T.white, outline: "none",
            }}
          />
          <button onClick={addSkill} style={{
            padding: "9px 20px", borderRadius: 10, background: T.orange,
            color: "#fff", border: "none", cursor: "pointer",
            fontSize: 13, fontWeight: 600, fontFamily: "'Sora', sans-serif",
            opacity: saving ? 0.6 : 1,
          }}>
            {saving ? "Saving…" : "Add"}
          </button>
        </div>

        {/* Skills chips */}
        {!loaded ? (
          <div style={{ fontSize: 12, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>Loading skills…</div>
        ) : (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {skills.map(skill => (
              <div key={skill} style={{
                display: "flex", alignItems: "center", gap: 5,
                padding: "5px 10px 5px 13px", borderRadius: 99,
                background: T.gray100, border: `1px solid ${T.gray200}`,
              }}>
                <span style={{ fontSize: 12, color: T.black, fontFamily: "'Sora', sans-serif" }}>{skill}</span>
                <button onClick={() => removeSkill(skill)} style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: T.gray400, fontSize: 15, padding: 0, lineHeight: 1,
                  display: "flex", alignItems: "center",
                }}>×</button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
};

// ─── Sidebar ──────────────────────────────────────────────────────────────────
const Sidebar = ({ active, setActive, collapsed, setCollapsed }) => {
  const history = [
    { label: "Allianz AI Engineer prep", time: "Today" },
    { label: "Skill gap analysis", time: "Today" },
    { label: "Munich market trends", time: "Yesterday" },
    { label: "HuggingFace LLM role", time: "Mar 7" },
    { label: "FinSense AI updates", time: "Mar 6" },
  ];

  return (
    <div style={{
      width: collapsed ? 64 : 240,
      flexShrink: 0,
      height: "100vh",
      display: "flex",
      flexDirection: "column",
      background: "rgba(255,255,255,0.85)",
      backdropFilter: "blur(32px) saturate(180%)",
      WebkitBackdropFilter: "blur(32px) saturate(180%)",
      borderRight: `1px solid ${T.gray200}`,
      transition: "width 0.3s cubic-bezier(0.34,1.56,0.64,1)",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Brand */}
      <div style={{ padding: "20px 16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${T.gray200}`, justifyContent: collapsed ? "center" : "flex-start" }}>
        {!collapsed && <div style={{ width: 32, height: 32, borderRadius: 10, background: T.orange, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: "#fff", fontWeight: 700, boxShadow: `0 4px 12px rgba(232,98,26,0.35)` }}>⬡</div>}
        {!collapsed && (
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: T.black, fontFamily: "'Sora', sans-serif", letterSpacing: "-0.02em" }}>OpenToWork</div>
            <div style={{ fontSize: 9, color: T.gray400, fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em" }}>Intelligence System</div>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} style={{ marginLeft: collapsed ? 0 : "auto", background: "none", border: "none", color: T.gray400, cursor: "pointer", fontSize: 16, flexShrink: 0, padding: 4 }}>
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {/* Nav */}
      <div style={{ padding: "12px 8px", flex: 1, overflow: "auto" }}>
        {!collapsed && <div style={{ fontSize: 9, color: T.gray400, letterSpacing: "0.12em", textTransform: "uppercase", padding: "4px 8px 10px", fontFamily: "'DM Mono', monospace" }}>Dashboard</div>}
        {navItems.map(item => (
          <button key={item.id} onClick={() => setActive(item.id)} style={{
            width: "100%", display: "flex", alignItems: "center", gap: 12,
            padding: "9px 12px", borderRadius: 10, cursor: "pointer", marginBottom: 2,
            background: active === item.id ? T.orangeXLight : "transparent",
            border: `1px solid ${active === item.id ? T.orange + "55" : "transparent"}`,
            color: active === item.id ? T.orange : T.gray600,
            transition: "all 0.18s", textAlign: "left",
            justifyContent: collapsed ? "center" : "flex-start",
          }}>
            <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
            {!collapsed && <span style={{ fontSize: 12, fontWeight: active === item.id ? 700 : 400, fontFamily: "'Sora', sans-serif" }}>{item.label}</span>}
          </button>
        ))}

        {!collapsed && (
          <>
            <div style={{ fontSize: 9, color: T.gray400, letterSpacing: "0.12em", textTransform: "uppercase", padding: "16px 8px 10px", fontFamily: "'DM Mono', monospace" }}>Recent Reports</div>
            {history.map((h, i) => (
              <button key={i} style={{
                width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start",
                padding: "7px 12px", borderRadius: 8, cursor: "pointer", marginBottom: 2,
                background: "transparent", border: "1px solid transparent",
                transition: "all 0.15s", textAlign: "left",
              }}
                onMouseEnter={e => { e.currentTarget.style.background = T.gray100; e.currentTarget.style.borderColor = T.gray200; }}
                onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "transparent"; }}
              >
                <span style={{ fontSize: 11, color: T.gray600, fontFamily: "'Sora', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", width: "100%" }}>{h.label}</span>
                <span style={{ fontSize: 9, color: T.gray400, fontFamily: "'DM Mono', monospace", marginTop: 1 }}>{h.time}</span>
              </button>
            ))}
          </>
        )}
      </div>

      {/* User — click to open Profile */}
      <button onClick={() => setActive("profile")} style={{
        padding: "14px 12px", borderTop: `1px solid ${T.gray200}`,
        display: "flex", alignItems: "center", gap: 10,
        background: active === "profile" ? T.orangeXLight : "transparent",
        border: "none", cursor: "pointer", width: "100%", textAlign: "left",
        transition: "background 0.18s",
      }}>
        <div style={{ width: 28, height: 28, borderRadius: 99, background: T.orange, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 800, boxShadow: `0 2px 8px rgba(232,98,26,0.3)` }}>V</div>
        {!collapsed && (
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: active === "profile" ? T.orange : T.black, fontFamily: "'Sora', sans-serif" }}>Vasu Chukka</div>
            <div style={{ fontSize: 9, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>Munich, DE</div>
          </div>
        )}
      </button>
    </div>
  );
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive] = useState(() => localStorage.getItem("activeTab") || "overview");
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => { localStorage.setItem("activeTab", active); }, [active]);
  const pageTitle = navItems.find(n => n.id === active)?.label || "";

  // ── Live data state (falls back to mock if API unavailable) ──
  const [jobs, setJobs] = useState(jobsData);
  const [liveStats, setLiveStats] = useState({ today: 23, total: 98, applied: 11, interviews: 3 });
  const [liveTrend, setLiveTrend] = useState(trendData);
  const [livePipeline, setLivePipeline] = useState(pipeline);

  useEffect(() => {
    fetchJobs().then(data => { if (data) setJobs(data); });
    fetchStats().then(data => {
      if (data) {
        setLiveStats({ today: data.today, total: data.total, applied: data.applied, interviews: data.interviews, last_run: data.last_run });
        if (data.trend?.length) setLiveTrend(data.trend);
        if (data.pipeline?.length) setLivePipeline(data.pipeline);
      }
    });
  }, []);

  const ctxValue = { jobs, trendData: liveTrend, pipeline: livePipeline, stats: liveStats };

  const renderPage = () => {
    if (active === "overview") return <Overview />;
    if (active === "jobs") return <JobsBoard />;
    if (active === "map") return <MapView />;
    if (active === "gaps") return <SkillGaps />;
    if (active === "timeline") return <Timeline />;
    if (active === "interview") return <InterviewPrepView />;
    if (active === "analytics") return <Analytics />;
    if (active === "profile") return <ProfileView />;
  };

  return (
    <DataCtx.Provider value={ctxValue}>
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Sora:wght@400;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F0EDE8; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(232,98,26,0.25); border-radius: 99px; }
        @keyframes pulse { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.5);opacity:0.5} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh", background: "#EDEAE4", fontFamily: "'Sora', sans-serif", position: "relative", overflow: "hidden" }}>
        {/* Ambient blobs */}
        <div style={{ position: "fixed", top: "-5%", right: "15%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,98,26,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "fixed", bottom: "5%", left: "25%", width: 400, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,98,26,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

        <Sidebar active={active} setActive={setActive} collapsed={collapsed} setCollapsed={setCollapsed} />

        <div style={{ flex: 1, overflow: "auto", position: "relative" }}>
          {/* Topbar */}
          <div style={{
            padding: "20px 32px",
            borderBottom: `1px solid ${T.gray200}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(237,234,228,0.85)",
            backdropFilter: "blur(20px)",
            position: "sticky", top: 0, zIndex: 10,
          }}>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, letterSpacing: "-0.01em", color: T.black, lineHeight: 1 }}>{pageTitle}</div>
              <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: T.gray400, marginTop: 2, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                {liveStats.last_run ? (() => { const d = new Date(liveStats.last_run); return `${d.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"})} · Last run ${d.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}`; })() : "No runs yet"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 16px", background: T.orangeXLight, borderRadius: 99, border: `1px solid ${T.orange}44` }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.orange, animation: "pulse 2s infinite" }} />
                <span style={{ fontSize: 11, color: T.orange, fontFamily: "'DM Mono', monospace", fontWeight: 500 }}>Agents running</span>
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "#fff", border: `1px solid ${T.gray200}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>🔔</div>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: "24px 32px", animation: "fadeUp 0.25s ease" }} key={active}>
            {renderPage()}
          </div>
        </div>
      </div>
    </>
    </DataCtx.Provider>
  );
}
