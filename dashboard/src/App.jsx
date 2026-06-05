import { useState, useEffect, useRef, createContext, useContext, useMemo } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LoginPage } from "./components/LoginPage";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { fetchJobs, fetchStats, fetchProfile, updateSkills, fetchGaps, fetchRadar, fetchDailySkills, tailorCV, previewTailorCV, previewCoverLetter, approveCoverLetter, previewTailorCVManual, tailorCVManual, previewCoverLetterManual, approveCoverLetterManual, fetchInterviewPrep, fetchScraperStats, fetchManualApplications, createManualApplication, updateManualApplicationStatus, deleteManualApplication, fetchLLMMode, setLLMMode, updateApplicationStatus, listUsers, createUser, deleteUser, changePassword, getUserSettings, updateUserSettings, getTraces, getAgentOpsSessions } from "./api";
import {
  AreaChart, Area, BarChart, Bar, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, LineChart, Line,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell
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
  silverMist: "#E4E4E4",
  midnightShadow: "#050505",
};

// ─── Empty State ──────────────────────────────────────────────────────────────
const EmptyState = ({ message = "No data found", sub = "" }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 32px", gap: 10, opacity: 0.5 }}>
    <div style={{ fontSize: 28 }}>◌</div>
    <div style={{ fontSize: 13, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif" }}>{message}</div>
    {sub && <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>{sub}</div>}
  </div>
);

// ─── Connection Banner ─────────────────────────────────────────────────────────
const ConnectionBanner = () => {
  const { apiStatus } = useData();
  if (apiStatus === "ok" || apiStatus === "loading") return null;
  return (
    <div style={{
      background: "rgba(220,53,69,0.08)", border: "1px solid rgba(220,53,69,0.2)",
      borderRadius: 10, padding: "10px 16px", marginBottom: 16,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#dc3545", flexShrink: 0 }} />
      <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: "#dc3545" }}>
        API unreachable — DB connection may be lost. Check SSH tunnel + FastAPI.
      </div>
    </div>
  );
};

// ─── Data ─────────────────────────────────────────────────────────────────────
const jobsData = [
  { id: 1, title: "AI Engineer", company: "Allianz", location: "Munich", score: 94, status: "new", remote: false, lat: 48.13, lng: 11.58, missing: ["Terraform"], matched: ["Python","Claude API","AWS"], date: "Today", url: "https://www.linkedin.com" },
  { id: 2, title: "ML Ops Engineer", company: "MAN", location: "Munich", score: 87, status: "applied", remote: false, lat: 48.15, lng: 11.60, missing: ["Kubernetes"], matched: ["Docker","PostgreSQL","Python"], date: "Today" },
  { id: 3, title: "Python Developer", company: "BMW Group", location: "Munich", score: 81, status: "interview", remote: false, lat: 48.17, lng: 11.55, missing: ["FastAPI"], matched: ["Python","AWS","Git"], date: "Yesterday" },
  { id: 4, title: "Data Engineer", company: "Siemens", location: "Remote", score: 76, status: "new", remote: true, missing: ["Spark","Kafka"], matched: ["Python","PostgreSQL"], date: "Yesterday" },
  { id: 5, title: "AI Product Manager", company: "N26", location: "Berlin", score: 72, status: "rejected", remote: false, lat: 52.52, lng: 13.40, missing: ["Product Roadmap"], matched: ["AI","Claude API"], date: "Mar 6" },
  { id: 6, title: "LLM Engineer", company: "HuggingFace", location: "Remote", score: 88, status: "new", remote: true, missing: ["LoRA","RLHF"], matched: ["Python","Transformers","Claude API"], date: "Today", url: "https://www.linkedin.com" },
  { id: 7, title: "Senior AI Engineer", company: "Zalando", location: "Berlin", score: 92, status: "new", remote: false, lat: 52.52, lng: 13.40, missing: ["MLflow"], matched: ["Python","Claude API","Docker"], date: "Today", url: "https://www.linkedin.com" },
  { id: 8, title: "ML Platform Engineer", company: "Celonis", location: "Munich", score: 91, status: "new", remote: false, lat: 48.13, lng: 11.58, missing: ["Spark"], matched: ["Python","AWS","PostgreSQL"], date: "Today", url: "https://www.linkedin.com" },
  { id: 9, title: "AI Research Engineer", company: "DeepMind", location: "Remote", score: 96, status: "new", remote: true, missing: [], matched: ["Python","Claude API","AWS","Docker"], date: "Today", url: "https://www.linkedin.com" },
  { id: 10, title: "LLM Product Engineer", company: "Mistral AI", location: "Remote", score: 93, status: "new", remote: true, missing: ["vLLM"], matched: ["Python","Transformers","FastAPI"], date: "Today", url: "https://www.linkedin.com" },
  { id: 11, title: "AI Infrastructure Lead", company: "Volkswagen", location: "Wolfsburg", score: 90, status: "new", remote: false, lat: 52.43, lng: 10.79, missing: ["Kubernetes"], matched: ["Python","AWS","PostgreSQL"], date: "Today", url: "https://www.linkedin.com" },
  { id: 12, title: "GenAI Engineer", company: "SAP", location: "Berlin", score: 95, status: "new", remote: false, lat: 52.52, lng: 13.40, missing: ["LangChain"], matched: ["Python","Claude API","FastAPI"], date: "Today", url: "https://www.linkedin.com" },
  { id: 13, title: "Applied AI Engineer", company: "Bosch", location: "Stuttgart", score: 91, status: "new", remote: false, lat: 48.78, lng: 9.18, missing: [], matched: ["Python","Docker","AWS","PostgreSQL"], date: "Today", url: "https://www.linkedin.com" },
  { id: 14, title: "AI Platform Engineer", company: "Spotify", location: "Berlin", score: 93, status: "new", remote: false, lat: 52.52, lng: 13.40, missing: ["Airflow"], matched: ["Python","Claude API","AWS"], date: "Today", url: "https://www.linkedin.com" },
  { id: 15, title: "ML Engineer", company: "Delivery Hero", location: "Berlin", score: 91, status: "new", remote: false, lat: 52.52, lng: 13.40, missing: ["Ray"], matched: ["Python","Docker","PostgreSQL"], date: "Today", url: "https://www.linkedin.com" },
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
  { id: 1,  name: "OpenToWork",       skills: ["Python","n8n","Claude API","React","PostgreSQL"], pct: 20,  status: "active",    start: 72, end: 100 },
  { id: 2,  name: "FinsenseAI",       skills: ["Python","Claude API","PostgreSQL","AWS"],          pct: 65,  status: "active",    start: 42, end: 88  },
  { id: 3,  name: "image-studio-CC",  skills: ["JavaScript","HTML","Claude Code"],                 pct: 85,  status: "active",    start: 58, end: 95  },
  { id: 4,  name: "autoTinglishSub",  skills: ["Python","Whisper","FFmpeg"],                       pct: 80,  status: "active",    start: 55, end: 90  },
  { id: 5,  name: "inspo-drop",       skills: ["TypeScript","Chrome Extension","CSS"],             pct: 60,  status: "paused",    start: 28, end: 72  },
  { id: 6,  name: "knowVasu",         skills: ["TypeScript","CSS"],                                pct: 40,  status: "paused",    start: 18, end: 55  },
  { id: 7,  name: "cvas-ChatBot",     skills: ["Python"],                                          pct: 55,  status: "paused",    start: 12, end: 48  },
  { id: 8,  name: "beyondLabel",      skills: ["Flutter","Dart","Swift"],                          pct: 30,  status: "paused",    start: 5,  end: 38  },
  { id: 9,  name: "RaspNet Protocol", skills: ["C","HTML","Raspberry Pi"],                         pct: 100, status: "completed", start: 0,  end: 25  },
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
  { stage: "Applied", count: 11 },
  { stage: "Rejected", count: 4 },
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
  { id: "tracker", label: "My Applications", icon: "◻" },
  { id: "map", label: "Map View", icon: "◎" },
  { id: "gaps", label: "Skill Gaps", icon: "△" },
  { id: "timeline", label: "Your Projects", icon: "▭" },
  { id: "interview", label: "Interview Prep", icon: "◇" },
  { id: "analytics", label: "Analytics", icon: "◉" },
  { id: "automation", label: "Automation Logs", icon: "⟳" },
  { id: "scraper", label: "Scrapper", icon: "⟐" },
  { id: "traces", label: "Traces", icon: "⟴" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const scoreColor = (s) => s >= 80 ? T.orange : s >= 60 ? "#6B6B6B" : "#9A9A9A";
const scoreBg = (s) => s >= 80 ? T.orangeXLight : s >= 60 ? "#EFEFEF" : "#F4F4F4";
const scoreTextColor = (s) => s >= 80 ? "#fff" : "#fff";
const scoreLabel = (s) => s >= 80 ? "Strong" : s >= 60 ? "Good" : "Weak";
const statusStyle = {
  new: { bg: T.gray200, color: T.gray600 },
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
  const [carouselIdx, setCarouselIdx] = useState(0);
  const CARD_W = 232; // 220px card + 12px gap
  const VISIBLE = 6;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const topMatches = jobs.filter(j => j.score >= 85 && new Date(j.scraped_at) >= oneWeekAgo).sort((a, b) => b.score - a.score).slice(0, 10);
  const maxIdx = Math.max(0, topMatches.length - VISIBLE);
  const moveCarousel = (dir) => setCarouselIdx(i => Math.max(0, Math.min(maxIdx, i + dir)));
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
        <Label>Daily Jobs Found — All Time</Label>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={trend}>
            <defs>
              <linearGradient id="og" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={T.orange} stopOpacity={0.15} />
                <stop offset="95%" stopColor={T.orange} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="day" tick={{ fill: T.gray400, fontSize: 10, fontFamily: "DM Mono" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
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
                <div style={{ width: `${(p.count / 98) * 100}%`, height: "100%", background: i === 0 ? T.gray400 : p.stage === "Rejected" ? "#e05252" : T.orange, borderRadius: 99, transition: "width 1s ease" }} />
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

    {/* Top Matches — transform carousel */}
    <Card style={{ padding: "24px 28px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Label>This Week's Top Matches</Label>
        <div style={{ display: "flex", gap: 6 }}>
          {[{ dir: -1, icon: "←" }, { dir: 1, icon: "→" }].map(({ dir, icon }) => (
            <button key={dir} onClick={() => moveCarousel(dir)} style={{
              width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.gray200}`,
              background: T.white, cursor: "pointer", fontSize: 14, color: T.gray600,
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
              opacity: (dir === -1 && carouselIdx === 0) || (dir === 1 && carouselIdx === maxIdx) ? 0.3 : 1,
            }}
              onMouseEnter={e => { if (e.currentTarget.style.opacity !== "0.3") { e.currentTarget.style.background = T.orange; e.currentTarget.style.color = "#fff"; e.currentTarget.style.borderColor = T.orange; }}}
              onMouseLeave={e => { e.currentTarget.style.background = T.white; e.currentTarget.style.color = T.gray600; e.currentTarget.style.borderColor = T.gray200; }}
            >{icon}</button>
          ))}
        </div>
      </div>
      {topMatches.length === 0 && <EmptyState message="No top matches this week" sub="No jobs scored ≥85 in the last 7 days" />}
      <div style={{ overflow: "hidden" }}>
        <div style={{
          display: "flex", gap: 12,
          transform: `translateX(-${carouselIdx * CARD_W}px)`,
          transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}>
          {topMatches.map(j => (
            <div key={j.id}
              onClick={() => j.url && window.open(j.url, "_blank")}
              style={{ minWidth: 220, width: 220, flexShrink: 0, padding: "16px", background: T.gray100, borderRadius: 14, border: `1px solid ${T.gray200}`, cursor: j.url ? "pointer" : "default", transition: "border-color 0.2s, background 0.2s" }}
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
                {!j.url && <Tag color={T.gray400} bg={T.gray200}>No URL</Tag>}
              </div>
            </div>
          ))}
          {topMatches.length === 0 && (
            <div style={{ color: T.gray400, fontSize: 13, fontFamily: "'DM Mono', monospace", padding: "20px 0" }}>No jobs scoring ≥90 today.</div>
          )}
        </div>
      </div>
    </Card>
  </div>
  );
};

// ─── Select style helper ──────────────────────────────────────────────────────
const SEL_ARROW = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%235A5A5A'/%3E%3C/svg%3E")`;
const selStyle = (active = false) => ({
  fontSize: 11, padding: "5px 22px 5px 12px", borderRadius: 99,
  fontFamily: "'DM Mono', monospace", outline: "none", cursor: "pointer",
  appearance: "none", WebkitAppearance: "none",
  backgroundImage: SEL_ARROW, backgroundRepeat: "no-repeat",
  backgroundPosition: "right 8px center", backgroundSize: "8px 5px",
  backgroundColor: active ? T.orangeXLight : T.gray100,
  border: `1px solid ${active ? T.orange : T.gray200}`,
  color: T.black,
});

// ─── Jobs Board ───────────────────────────────────────────────────────────────
const JobsBoard = () => {
  const { jobs } = useData();
  const [selected, setSelected] = useState(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [dateRange, setDateRange] = useState("all");
  const [scoreFilter, setScoreFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("newest");
  const [statusFilter, setStatusFilter] = useState("all");
  const [statusMap, setStatusMap] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [tailoring, setTailoring] = useState(false);
  const [tailored, setTailored] = useState({});
  const [includeCoverLetter, setIncludeCoverLetter] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showTailorModal, setShowTailorModal] = useState(false);
  const [localAdd, setLocalAdd] = useState([]);
  const [localRemove, setLocalRemove] = useState([]);
  const [addInput, setAddInput] = useState("");
  const [removeInput, setRemoveInput] = useState("");
  const [clPreview, setClPreview] = useState(null);       // { letter_text, scorecard, iterations, passes }
  const [clLoading, setClLoading] = useState(false);
  const [clApproving, setClApproving] = useState(false);
  const [clError, setClError] = useState(null);

  const effectiveStatus = (j) => statusMap[j.id] ?? j.status ?? "new";

  const handleOpenTailorModal = async (job) => {
    setPreviewLoading(true);
    setClPreview(null);
    setClError(null);
    try {
      const preview = await previewTailorCV(job.id);
      setLocalAdd(preview.skills_to_add || []);
      setLocalRemove(preview.skills_to_remove || []);
      setShowTailorModal(true);
    } catch (e) {
      console.error("[Preview]", e);
    }
    setPreviewLoading(false);
  };

  const handleRunTailor = async () => {
    setTailoring(true);
    try {
      const approvedText = clPreview?.letter_text || null;
      const result = await tailorCV(selected.id, includeCoverLetter, localAdd, localRemove, approvedText);
      setTailored(prev => ({ ...prev, [selected.id]: result }));
      setShowTailorModal(false);
      setClPreview(null);
    } catch (e) {
      console.error("[Tailor CV]", e);
    }
    setTailoring(false);
  };

  const handlePreviewCoverLetter = async () => {
    setClLoading(true);
    setClError(null);
    try {
      const result = await previewCoverLetter(selected.id);
      setClPreview(result);
    } catch (e) {
      console.error("[CL Preview]", e);
      setClError("Failed to generate cover letter. Check API connection.");
    }
    setClLoading(false);
  };

  const handleApproveCoverLetter = async () => {
    if (!clPreview) return;
    setClApproving(true);
    setClError(null);
    try {
      await approveCoverLetter(selected.id, clPreview.letter_text);
      // Now run full tailoring with the approved letter text
      setTailoring(true);
      const result = await tailorCV(selected.id, true, localAdd, localRemove, clPreview.letter_text);
      setTailored(prev => ({ ...prev, [selected.id]: result }));
      setShowTailorModal(false);
      setClPreview(null);
    } catch (e) {
      console.error("[CL Approve]", e);
      setClError("Approve failed. Check API connection.");
    }
    setClApproving(false);
    setTailoring(false);
  };

  const setJobStatus = (jobId, status, e) => {
    e.stopPropagation();
    setStatusMap(prev => ({ ...prev, [jobId]: status }));
    updateApplicationStatus(jobId, status);
  };

  const today = () => { const d = new Date(); d.setHours(0,0,0,0); return d; };
  const cutoff = (days) => { const d = new Date(); d.setDate(d.getDate() - days); return d; };

  const locationOptions = ["All locations", "Remote only", ...Array.from(new Set(jobs.map(j => j.location).filter(Boolean))).sort()];

  const filtered = jobs.filter(j => {
    if (locationFilter === "Remote only") { if (!j.remote) return false; }
    else if (locationFilter && locationFilter !== "All locations") {
      if (!j.location?.toLowerCase().includes(locationFilter.toLowerCase())) return false;
    }
    const ref = j.scraped_at ? new Date(j.scraped_at) : null;
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
    if (statusFilter !== "all" && effectiveStatus(j) !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!j.title?.toLowerCase().includes(q) && !j.company?.toLowerCase().includes(q) && !j.location?.toLowerCase().includes(q)) return false;
    }
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

  const [detailWidth, setDetailWidth] = useState(() => Math.floor((window.innerWidth - 180) * 0.45));
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
    <>
    <div style={{ marginBottom: 12 }}>
      <input
        type="text"
        placeholder="Search by title, company or city…"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        style={{
          width: "100%", boxSizing: "border-box",
          padding: "10px 18px", borderRadius: 12,
          border: `1px solid ${T.gray200}`,
          background: "rgba(255,255,255,0.8)",
          fontFamily: "'Sora', sans-serif", fontSize: 13,
          color: T.black, outline: "none",
          backdropFilter: "blur(8px)",
        }}
      />
    </div>
    <div style={{ display: "flex", gap: 14, height: "calc(100vh - 180px)" }}>
      <Card style={{ flex: 1, padding: "24px", overflow: "auto" }}>
        {/* Single filter row */}
        <div style={{ display: "flex", gap: 8, marginBottom: 18, alignItems: "center", flexWrap: "wrap" }}>
          <select value={locationFilter || "All locations"} onChange={e => setLocationFilter(e.target.value === "All locations" ? "" : e.target.value)} style={selStyle(!!locationFilter && locationFilter !== "All locations")}>
            {locationOptions.map(loc => <option key={loc} value={loc}>{loc}</option>)}
          </select>
          <Sep />
          <select value={dateRange} onChange={e => setDateRange(e.target.value)} style={selStyle(dateRange !== "all")}>
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="3">Last 3 days</option>
            <option value="7">Last 7 days</option>
            <option value="10">Last 10 days</option>
            <option value="10-30">10–30 days ago</option>
          </select>
          <Sep />
          <select value={scoreFilter} onChange={e => setScoreFilter(e.target.value)} style={selStyle(scoreFilter !== "all")}>
            <option value="all">All scores</option>
            <option value="80">80+ Green</option>
            <option value="60">60–79 Yellow</option>
            <option value="scored">Scored only</option>
            <option value="unscored">Unscored</option>
          </select>
          <Sep />
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={selStyle(statusFilter !== "all")}>
            <option value="all">All statuses</option>
            <option value="new">New</option>
            <option value="applied">Applied</option>
            <option value="interview">Interview</option>
            <option value="rejected">Rejected</option>
            <option value="offer">Offer</option>
          </select>
          <Sep />
          <select value={sortOrder} onChange={e => setSortOrder(e.target.value)} style={selStyle(false)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 && (
            <EmptyState
              message={jobs.length === 0 ? "No jobs found" : "No jobs match your filters"}
              sub={jobs.length === 0 ? "Run Agent 1 to scrape jobs, or check DB connection" : "Try clearing your filters"}
            />
          )}
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
              <select
                value={effectiveStatus(j)}
                onClick={e => e.stopPropagation()}
                onChange={e => setJobStatus(j.id, e.target.value, e)}
                style={{
                  fontSize: 10, padding: "4px 20px 4px 8px", borderRadius: 99,
                  fontFamily: "'DM Mono', monospace", outline: "none", cursor: "pointer", flexShrink: 0,
                  appearance: "none", WebkitAppearance: "none",
                  backgroundImage: SEL_ARROW, backgroundRepeat: "no-repeat",
                  backgroundPosition: "right 7px center", backgroundSize: "7px 4px",
                  border: `1px solid ${statusStyle[effectiveStatus(j)]?.color ?? T.gray200}`,
                  backgroundColor: statusStyle[effectiveStatus(j)]?.bg ?? T.gray100,
                  color: statusStyle[effectiveStatus(j)]?.color ?? T.gray600,
                }}
              >
                <option value="new">New</option>
                <option value="applied">Applied</option>
                <option value="interview">Interview</option>
                <option value="rejected">Rejected</option>
                <option value="offer">Offer</option>
              </select>
              <Tag color={j.source === "linkedin" ? "#0A66C2" : j.source === "indeed" ? "#8B2FC9" : "#2E6B3E"} bg={j.source === "linkedin" ? "#E8F0F9" : j.source === "indeed" ? "#F3E8FD" : "#E8F4EC"}>{j.source === "linkedin" ? "LinkedIn" : j.source === "indeed" ? "Indeed" : "Agentur"}</Tag>
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
                onClick={() => !previewLoading && !tailoring && handleOpenTailorModal(selected)}
                disabled={previewLoading || tailoring}
                style={{
                  width: "100%", padding: "12px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                  fontFamily: "'DM Mono', monospace", transition: "all 0.2s",
                  background: tailored[selected.id] ? T.green : T.orange,
                  border: "none", color: "#fff",
                  cursor: previewLoading ? "wait" : "pointer",
                  opacity: previewLoading ? 0.8 : 1,
                }}
              >{previewLoading ? "⏳ Analyzing..." : tailored[selected.id] ? "✓ CV Tailored" : "✂ Tailor CV"}</button>
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
              >↗ {selected.url ? `Apply on ${selected.source === "linkedin" ? "LinkedIn" : selected.source === "indeed" ? "Indeed" : "Arbeitsagentur"}` : "No Apply Link"}</button>
            </div>
          </div>
        )}
        </Card>
      </div>
    </div>

    {/* ── Tailor CV Modal ── */}
    {showTailorModal && selected && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: 540, maxHeight: "85vh", overflow: "auto", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
          <button onClick={() => setShowTailorModal(false)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 18, color: T.gray400, cursor: "pointer" }}>✕</button>

          <div style={{ fontSize: 16, fontWeight: 800, color: T.black, fontFamily: "'Sora', sans-serif", marginBottom: 4 }}>CV Tailoring Preview</div>
          <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace", marginBottom: 24 }}>{selected.title} @ {selected.company}</div>

          {/* Skills to Add */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.gray600, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Skills to Add</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {localAdd.map(s => (
                <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 99, background: T.orangeXLight, border: `1px solid ${T.orange}`, color: T.orange, fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
                  {s}
                  <button onClick={() => setLocalAdd(localAdd.filter(x => x !== s))} style={{ background: "none", border: "none", color: T.orange, cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
              {localAdd.length === 0 && <span style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>None suggested</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={addInput} onChange={e => setAddInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && addInput.trim()) { setLocalAdd([...localAdd, addInput.trim()]); setAddInput(""); }}} placeholder="Add a skill..." style={{ flex: 1, fontSize: 11, padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.gray200}`, fontFamily: "'DM Mono', monospace", outline: "none" }} />
              <button onClick={() => { if (addInput.trim()) { setLocalAdd([...localAdd, addInput.trim()]); setAddInput(""); }}} style={{ padding: "6px 12px", borderRadius: 8, background: T.orange, border: "none", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>+</button>
            </div>
          </div>

          {/* Skills to Remove */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.gray600, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>Skills to Remove</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {localRemove.map(s => (
                <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 99, background: T.redLight, border: `1px solid ${T.red}`, color: T.red, fontSize: 11, fontFamily: "'DM Mono', monospace" }}>
                  {s}
                  <button onClick={() => setLocalRemove(localRemove.filter(x => x !== s))} style={{ background: "none", border: "none", color: T.red, cursor: "pointer", fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              ))}
              {localRemove.length === 0 && <span style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>None suggested</span>}
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <input value={removeInput} onChange={e => setRemoveInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && removeInput.trim()) { setLocalRemove([...localRemove, removeInput.trim()]); setRemoveInput(""); }}} placeholder="Add skill to remove..." style={{ flex: 1, fontSize: 11, padding: "6px 10px", borderRadius: 8, border: `1px solid ${T.gray200}`, fontFamily: "'DM Mono', monospace", outline: "none" }} />
              <button onClick={() => { if (removeInput.trim()) { setLocalRemove([...localRemove, removeInput.trim()]); setRemoveInput(""); }}} style={{ padding: "6px 12px", borderRadius: 8, background: T.red, border: "none", color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>+</button>
            </div>
          </div>

          {/* Cover letter toggle */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: includeCoverLetter ? 12 : 16 }}>
            <input type="checkbox" id="cover-letter-modal" checked={includeCoverLetter} onChange={e => { setIncludeCoverLetter(e.target.checked); if (!e.target.checked) { setClPreview(null); setClError(null); } }} style={{ accentColor: T.orange, cursor: "pointer", width: 14, height: 14 }} />
            <label htmlFor="cover-letter-modal" style={{ fontSize: 11, color: T.gray400, cursor: "pointer", fontFamily: "'DM Mono', monospace", userSelect: "none" }}>Include cover letter</label>
          </div>

          {/* Cover letter Agent 8 section */}
          {includeCoverLetter && (
            <div style={{ marginBottom: 16 }}>
              {/* Preview button */}
              {!clPreview && (
                <button
                  onClick={handlePreviewCoverLetter}
                  disabled={clLoading}
                  style={{ width: "100%", padding: "10px", borderRadius: 10, background: clLoading ? T.gray200 : "#1a1a2e", border: "none", color: "#fff", fontWeight: 700, fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: clLoading ? "wait" : "pointer", marginBottom: 8 }}
                >
                  {clLoading ? "⏳ Generating letter..." : "✉ Preview Cover Letter"}
                </button>
              )}

              {clError && (
                <div style={{ fontSize: 11, color: T.red, fontFamily: "'DM Mono', monospace", marginBottom: 8, padding: "8px 12px", background: T.redLight, borderRadius: 8 }}>{clError}</div>
              )}

              {/* Letter preview + scorecard */}
              {clPreview && (
                <div style={{ border: `1px solid ${T.gray200}`, borderRadius: 12, padding: 16, marginBottom: 12, background: "#fafafa" }}>
                  {/* Score header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: T.gray600, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>Cover Letter Preview</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: clPreview.passes ? "#16a34a" : T.orange, fontFamily: "'DM Mono', monospace" }}>{clPreview.scorecard?.overall?.toFixed(1)}/10</span>
                      <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: clPreview.passes ? "#dcfce7" : "#fff3e0", color: clPreview.passes ? "#16a34a" : T.orange, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{clPreview.passes ? "PASSES" : "REVIEW"}</span>
                    </div>
                  </div>

                  {/* Scorecard bars */}
                  <div style={{ marginBottom: 12 }}>
                    {clPreview.scorecard?.scores && Object.entries(clPreview.scorecard.scores).map(([dim, score]) => (
                      <div key={dim} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <div style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono', monospace", width: 110, flexShrink: 0 }}>{dim.replace(/_/g, " ")}</div>
                        <div style={{ flex: 1, height: 5, background: T.gray200, borderRadius: 99, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${score * 10}%`, background: score >= 8 ? "#16a34a" : score >= 6 ? T.orange : T.red, borderRadius: 99 }} />
                        </div>
                        <div style={{ fontSize: 10, color: T.gray600, fontFamily: "'DM Mono', monospace", width: 16, textAlign: "right" }}>{score}</div>
                      </div>
                    ))}
                  </div>

                  {/* Letter text (scrollable) */}
                  <div style={{ fontSize: 11, color: T.gray600, fontFamily: "'Sora', sans-serif", lineHeight: 1.7, maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap", padding: "10px 12px", background: "#fff", borderRadius: 8, border: `1px solid ${T.gray200}`, marginBottom: 10 }}>
                    {clPreview.letter_text}
                  </div>

                  {/* Suggestions */}
                  {clPreview.scorecard?.suggestions?.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {clPreview.scorecard.suggestions.map((s, i) => (
                        <div key={i} style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono', monospace", marginBottom: 2 }}>• {s}</div>
                      ))}
                    </div>
                  )}

                  {/* Re-run / Approve */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={handlePreviewCoverLetter}
                      disabled={clLoading}
                      style={{ flex: 1, padding: "9px", borderRadius: 9, background: "#fff", border: `1px solid ${T.gray200}`, color: T.gray600, fontWeight: 700, fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: clLoading ? "wait" : "pointer" }}
                    >
                      {clLoading ? "⏳ Regenerating..." : "↺ Re-run"}
                    </button>
                    <button
                      onClick={handleApproveCoverLetter}
                      disabled={clApproving || tailoring}
                      style={{ flex: 2, padding: "9px", borderRadius: 9, background: "#16a34a", border: "none", color: "#fff", fontWeight: 700, fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: (clApproving || tailoring) ? "wait" : "pointer", opacity: (clApproving || tailoring) ? 0.8 : 1 }}
                    >
                      {clApproving || tailoring ? "⏳ Generating ZIP..." : "✓ Approve & Generate ZIP"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Run button — shown only when cover letter is OFF, or as secondary when no preview yet */}
          {(!includeCoverLetter || !clPreview) && (
            <button onClick={handleRunTailor} disabled={tailoring || clLoading} style={{ width: "100%", padding: "14px", borderRadius: 12, background: T.orange, border: "none", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "'DM Mono', monospace", cursor: (tailoring || clLoading) ? "wait" : "pointer", opacity: (tailoring || clLoading) ? 0.8 : 1, boxShadow: `0 4px 16px rgba(232,98,26,0.3)` }}>
              {tailoring ? "⏳ Tailoring CV..." : includeCoverLetter ? "✂ Tailor CV only (skip letter preview)" : "✂ Run Tailoring"}
            </button>
          )}
        </div>
      </div>
    )}
    </>
  );
};

// ─── Map View ─────────────────────────────────────────────────────────────────
const CITY_COORDS = {
  "münchen": [48.137, 11.576], "munich": [48.137, 11.576], "muenchen": [48.137, 11.576],
  "berlin": [52.520, 13.405],
  "hamburg": [53.551, 10.000],
  "frankfurt": [50.110, 8.682],
  "stuttgart": [48.775, 9.182],
  "düsseldorf": [51.227, 6.773], "dusseldorf": [51.227, 6.773],
  "cologne": [50.938, 6.960], "köln": [50.938, 6.960], "koeln": [50.938, 6.960],
  "nuremberg": [49.452, 11.077], "nürnberg": [49.452, 11.077], "nuernberg": [49.452, 11.077],
  "hannover": [52.374, 9.738], "hanover": [52.374, 9.738],
  "leipzig": [51.340, 12.375],
  "bremen": [53.079, 8.801],
  "dresden": [51.050, 13.738],
  "mannheim": [49.487, 8.466],
  "augsburg": [48.370, 10.897],
  "dortmund": [51.514, 7.468],
  "essen": [51.455, 7.011],
  "wiesbaden": [50.078, 8.239],
  "bonn": [50.735, 7.099],
  "karlsruhe": [49.006, 8.404],
  "wuppertal": [51.264, 7.178],
  "bielefeld": [52.021, 8.534],
  "bochum": [51.482, 7.216],
  "münster": [51.961, 7.628], "muenster": [51.961, 7.628],
  "germany": [51.163, 10.448],
  "deutschland": [51.163, 10.448],
};

const getCityLatLng = (location) => {
  if (!location) return null;
  const key = location.toLowerCase().trim().replace(/,.*$/, "").trim(); // strip ", Germany" etc
  if (CITY_COORDS[key]) return CITY_COORDS[key];
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (key.includes(city)) return coords;
  }
  // fallback: check original string with country stripped
  const full = location.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (full.includes(city)) return coords;
  }
  return null;
};

const makeCityIcon = (count) => {
  const hot = count >= 50;
  const bg = hot ? "#E8621A" : "#050505";
  const shadow = hot ? "rgba(232,98,26,0.4)" : "rgba(5,5,5,0.25)";
  return L.divIcon({
    className: "",
    html: `<div style="
      width:48px;height:48px;border-radius:50%;
      background:${bg};color:#fff;
      display:flex;align-items:center;justify-content:center;
      font-family:'Bebas Neue',Anton,sans-serif;font-size:18px;letter-spacing:0.5px;
      border:3px solid #fff;
      box-shadow:0 4px 20px ${shadow};
      cursor:pointer;
    ">${count}</div>`,
    iconSize: [48, 48],
    iconAnchor: [24, 24],
    popupAnchor: [0, -28],
  });
};

const FlyTo = ({ pos }) => { const map = useMap(); useEffect(() => { if (pos) map.flyTo(pos, 10, { duration: 1.2 }); }, [pos, map]); return null; };

const MapView = () => {
  const { jobs } = useData();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [flyTo, setFlyTo] = useState(null);

  const withCoords = useMemo(() =>
    jobs.map(j => ({ ...j, _latlng: getCityLatLng(j.location) })),
    [jobs]
  );

  const onsite = withCoords.filter(j => !j.remote && j._latlng);

  // Group onsite jobs by city (using latlng as key)
  const cityGroups = useMemo(() => {
    const groups = {};
    onsite.forEach(j => {
      const key = j._latlng.join(",");
      if (!groups[key]) groups[key] = { latlng: j._latlng, jobs: [], city: j.location };
      groups[key].jobs.push(j);
    });
    return Object.values(groups);
  }, [onsite]);
  const allList = withCoords.filter(j => {
    const q = search.toLowerCase();
    return !q || j.title?.toLowerCase().includes(q) || j.company?.toLowerCase().includes(q) || j.location?.toLowerCase().includes(q);
  });

  const handleSelect = (j) => {
    setSelected(j);
    if (j._latlng) setFlyTo(j._latlng);
  };

  return (
    <div style={{ display: "flex", height: "calc(100vh - 140px)", gap: 0, borderRadius: 18, overflow: "hidden", boxShadow: "0 2px 24px rgba(0,0,0,0.12)" }}>
      {/* ── Left Sidebar ── */}
      <div style={{ width: 300, flexShrink: 0, background: "#fff", display: "flex", flexDirection: "column", borderRadius: "18px 0 0 18px", overflow: "hidden", borderRight: `1px solid ${T.gray200}` }}>
        {/* Header */}
        <div style={{ padding: "20px 20px 12px", borderBottom: `1px solid ${T.gray200}` }}>
          <div style={{ fontFamily: "'Bebas Neue',Anton,sans-serif", fontSize: 22, letterSpacing: 2, color: T.black, marginBottom: 12 }}>JOB MAP</div>
          <div style={{ position: "relative" }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search jobs, companies..."
              style={{
                width: "100%", padding: "9px 14px 9px 36px", borderRadius: 10,
                background: T.gray100, border: `1px solid ${T.gray200}`,
                color: T.black, fontSize: 12, fontFamily: "'DM Mono',monospace", outline: "none",
                boxSizing: "border-box",
              }}
            />
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: T.gray400, fontSize: 13 }}>⌕</span>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 6 }}>
            <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: T.gray600, padding: "3px 8px", borderRadius: 99, border: `1px solid ${T.gray200}`, background: T.gray100 }}>
              {onsite.length} on-site
            </span>
            <span style={{ fontSize: 10, fontFamily: "'DM Mono',monospace", color: T.gray600, padding: "3px 8px", borderRadius: 99, border: `1px solid ${T.gray200}`, background: T.gray100 }}>
              {withCoords.filter(j => j.remote).length} remote
            </span>
          </div>
        </div>

        {/* Job list */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {allList.map(j => {
            const col = scoreColor(j.score);
            const isActive = selected?.id === j.id;
            return (
              <div key={j.id} onClick={() => handleSelect(j)} style={{
                display: "flex", alignItems: "center", gap: 12, padding: "12px 16px",
                cursor: "pointer", transition: "background 0.15s",
                background: isActive ? T.orangeXLight : "transparent",
                borderLeft: `3px solid ${isActive ? T.orange : "transparent"}`,
              }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = T.gray100; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  background: scoreColor(j.score), display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Bebas Neue',Anton,sans-serif", fontSize: 13, color: "#fff",
                  boxShadow: `0 2px 8px ${scoreColor(j.score)}55`,
                }}>
                  {j.score || "—"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: T.black, fontFamily: "'Sora',sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{j.title}</div>
                  <div style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono',monospace", marginTop: 2 }}>
                    {j.company} · {j.remote ? "🌐 Remote" : j.location}
                  </div>
                </div>
                <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 99, flexShrink: 0,
                  background: j.source === "linkedin" ? "#E8F0F9" : j.source === "indeed" ? "#F3E8FD" : "#E8F4EC",
                  color: j.source === "linkedin" ? "#0A66C2" : j.source === "indeed" ? "#8B2FC9" : "#2E6B3E",
                  fontFamily: "'DM Mono',monospace" }}>
                  {j.source === "linkedin" ? "LI" : j.source === "indeed" ? "IN" : "DE"}
                </span>
              </div>
            );
          })}
          {allList.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: T.gray400, fontSize: 12, fontFamily: "'DM Mono',monospace" }}>No jobs found</div>
          )}
        </div>
      </div>

      {/* ── Map ── */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapContainer
          center={[51.0, 10.0]}
          zoom={6}
          style={{ width: "100%", height: "100%" }}
          zoomControl={false}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>'
            subdomains="abcd"
            maxZoom={19}
          />
          <FlyTo pos={flyTo} />
          {cityGroups.map(group => (
            <Marker
              key={group.latlng.join(",")}
              position={group.latlng}
              icon={makeCityIcon(group.jobs.length)}
            >
              <Popup closeButton={false} maxWidth={280}>
                <div style={{
                  background: "#fff", borderRadius: 14, padding: "14px", width: 260,
                  border: `1px solid ${T.gray200}`, fontFamily: "'Sora',sans-serif",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div style={{ fontFamily: "'Bebas Neue',Anton,sans-serif", fontSize: 16, letterSpacing: 1, color: T.black }}>{group.city?.split(",")[0]?.toUpperCase()}</div>
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: T.orangeXLight, color: T.orange, fontFamily: "'DM Mono',monospace" }}>{group.jobs.length} jobs</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                    {group.jobs.map(j => (
                      <div key={j.id} style={{ padding: "8px 10px", background: T.gray100, borderRadius: 10, border: `1px solid ${T.gray200}` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: T.black }}>{j.title}</div>
                          <div style={{ fontFamily: "'Bebas Neue',Anton,sans-serif", fontSize: 16, lineHeight: 1, padding: "2px 6px", borderRadius: 6, background: scoreColor(j.score), color: "#fff" }}>{j.score}</div>
                        </div>
                        <div style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono',monospace", marginBottom: 6 }}>{j.company}</div>
                        {j.url ? <button onClick={() => window.open(j.url, "_blank")} style={{ padding: "4px 10px", borderRadius: 7, cursor: "pointer", background: T.orange, border: "none", color: "#fff", fontSize: 10, fontFamily: "'DM Mono',monospace" }}>↗ Apply</button> : <span style={{ padding: "4px 10px", borderRadius: 7, background: T.gray200, color: T.gray400, fontSize: 10, fontFamily: "'DM Mono',monospace" }}>No URL</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Selected job overlay (bottom-right) */}
        {selected && !selected._latlng && (
          <div style={{
            position: "absolute", bottom: 20, right: 20, zIndex: 1000,
            background: "#fff", borderRadius: 14, padding: "16px", width: 260,
            border: `1px solid ${T.gray200}`, boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.black, fontFamily: "'Sora',sans-serif" }}>{selected.title}</div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: T.gray400, cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
            <div style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono',monospace", marginBottom: 12 }}>
              {selected.company} · {selected.remote ? "🌐 Remote" : selected.location}
            </div>
            {selected.url
              ? <button onClick={() => window.open(selected.url, "_blank")} style={{ width: "100%", padding: "9px", borderRadius: 9, cursor: "pointer", background: T.orange, border: "none", color: "#fff", fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace" }}>↗ Apply Now</button>
              : <div style={{ width: "100%", padding: "9px", borderRadius: 9, background: T.gray200, color: T.gray400, fontSize: 11, fontWeight: 700, fontFamily: "'DM Mono',monospace", textAlign: "center" }}>No URL Available</div>
            }
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Skill Gaps ───────────────────────────────────────────────────────────────
const SkillGaps = () => {
  const [gaps, setGaps] = useState(null);
  const [liveRadar, setLiveRadar] = useState(null);
  const [dailySkills, setDailySkills] = useState(null);

  useEffect(() => {
    fetchGaps().then(data => { if (data?.length) setGaps(data); });
    fetchRadar().then(data => { if (data?.length) setLiveRadar(data); });
    fetchDailySkills().then(data => { if (data?.length) setDailySkills(data); });
  }, []);

  const [actionPage, setActionPage] = useState(0);
  const ACTION_PAGE_SIZE = 6;

  const actionCards = gaps
    ? gaps.map(g => ({
        skill: g.skill,
        count: g.frequency,
        project: g.project_mapping || null,
        howTo: g.how_to_implement || null,
        course: g.online_course || null,
        exampleProject: g.example_project || null,
      }))
    : [
        { skill: "Kubernetes", count: 8, project: "FinsenseAI", howTo: "Add K8s Deployment + Service manifests to deploy the FastAPI app", course: null, exampleProject: null },
        { skill: "Terraform", count: 6, project: null, howTo: null, course: "HashiCorp Terraform Associate — Udemy (~12h)", exampleProject: "Provision EC2 + RDS on AWS using Terraform modules" },
        { skill: "LangChain", count: 5, project: "RAG Chatbot", howTo: "Swap the raw vector search for a LangChain retrieval chain with memory", course: null, exampleProject: null },
      ];

  const actionTotalPages = Math.ceil(actionCards.length / ACTION_PAGE_SIZE);
  const actionPageCards = actionCards.slice(actionPage * ACTION_PAGE_SIZE, (actionPage + 1) * ACTION_PAGE_SIZE);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
        <div style={{ resize: "both", overflow: "hidden", minWidth: 400, minHeight: 456, width: "calc(60% - 7px)", height: 456, boxSizing: "border-box" }}>
        <Card style={{ padding: "24px 28px", width: "100%", height: "100%", boxSizing: "border-box" }}>
          <Label>All Skills {dailySkills && <span style={{ color: T.orange, fontFamily: "'DM Mono', monospace", fontSize: 10 }}>· live</span>}</Label>
          <div style={{ height: "calc(100% - 36px)", overflowY: "auto", paddingRight: 4 }}>
            {(dailySkills || []).length === 0 ? (
              <div style={{ color: T.gray400, fontSize: 12, fontFamily: "'DM Mono', monospace", paddingTop: 16 }}>No data yet — waiting for today's pipeline run.</div>
            ) : (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignContent: "flex-start" }}>
                {(dailySkills || []).map((s, i) => {
                  const max = dailySkills[0]?.count || 1;
                  const intensity = s.count / max;
                  const bg = intensity > 0.6 ? T.orange : intensity > 0.3 ? "#F5884A" : T.silverMist;
                  const color = intensity > 0.3 ? "#fff" : T.gray600;
                  return (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "5px 10px", borderRadius: 99,
                      background: bg, color,
                      fontFamily: "'DM Mono', monospace", fontSize: 11,
                    }}>
                      <span>{s.skill}</span>
                      <span style={{ fontSize: 9, opacity: 0.85, fontWeight: 700 }}>{s.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
        </div>

        <div style={{ resize: "both", overflow: "hidden", minWidth: 340, minHeight: 456, width: "calc(40% - 7px)", height: 456, boxSizing: "border-box" }}>
        <Card style={{ padding: "24px 28px", width: "100%", height: "100%", boxSizing: "border-box" }}>
          <Label>Skills Radar {liveRadar && <span style={{ color: T.orange, fontFamily: "'DM Mono', monospace", fontSize: 10 }}>· live</span>}</Label>
          <div style={{ height: "calc(100% - 36px)" }}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={liveRadar || radarData} outerRadius="72%">
              <PolarGrid stroke={T.gray200} strokeDasharray="0" />
              <PolarAngleAxis
                dataKey="subject"
                tick={{ fill: T.gray600, fontSize: 10, fontFamily: "DM Mono" }}
                tickLine={false}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: T.gray400, fontSize: 9, fontFamily: "DM Mono" }}
                ticks={[0, 35, 65, 100]}
                axisLine={false}
              />
              <Radar
                name="Your Skills"
                dataKey="you"
                stroke={T.orange}
                fill={T.orange}
                fillOpacity={0.45}
                strokeWidth={2.5}
                dot={{ r: 4, fill: T.orange, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: T.orange }}
              />
              <Radar
                name="Market Demand"
                dataKey="market"
                stroke="#888888"
                fill="#888888"
                fillOpacity={0.3}
                strokeWidth={2}
                dot={{ r: 4, fill: "#888888", stroke: "#fff", strokeWidth: 1 }}
              />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: 10, fontFamily: "DM Mono", paddingTop: 8 }}
                formatter={(value) => <span style={{ color: T.gray600 }}>{value}</span>}
              />
            </RadarChart>
          </ResponsiveContainer>
          </div>
        </Card>
        </div>
      </div>

      <Card style={{ padding: "24px 28px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <Label style={{ marginBottom: 0 }}>Gap → Action Suggestions {gaps && <span style={{ color: T.orange, fontFamily: "'DM Mono', monospace", fontSize: 10 }}>· live</span>}</Label>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: T.gray600, fontFamily: "'DM Mono', monospace" }}>{actionPage + 1} / {actionTotalPages}</span>
            <button
              onClick={() => setActionPage(p => Math.max(0, p - 1))}
              disabled={actionPage === 0}
              style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.gray200}`, background: actionPage === 0 ? T.gray100 : T.white, cursor: actionPage === 0 ? "default" : "pointer", fontSize: 14, color: actionPage === 0 ? T.gray400 : T.black, display: "flex", alignItems: "center", justifyContent: "center" }}
            >‹</button>
            <button
              onClick={() => setActionPage(p => Math.min(actionTotalPages - 1, p + 1))}
              disabled={actionPage === actionTotalPages - 1}
              style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${T.gray200}`, background: actionPage === actionTotalPages - 1 ? T.gray100 : T.white, cursor: actionPage === actionTotalPages - 1 ? "default" : "pointer", fontSize: 14, color: actionPage === actionTotalPages - 1 ? T.gray400 : T.black, display: "flex", alignItems: "center", justifyContent: "center" }}
            >›</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
          {actionPageCards.map(g => (
            <div key={g.skill} style={{ padding: "18px", background: T.gray100, borderRadius: 14, border: `1px solid ${T.gray200}`, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div style={{ fontFamily: "'Bebas Neue', 'Anton', sans-serif", fontSize: 26, lineHeight: 1, color: T.black }}>{g.skill}</div>
                <Tag color={T.red} bg={T.redLight}>{g.count} jobs</Tag>
              </div>
              {g.project ? (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.orange, fontFamily: "'DM Mono', monospace", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    → Add to: {g.project}
                  </div>
                  {g.howTo && (
                    <div style={{ fontSize: 11, color: T.gray600, lineHeight: 1.6, fontFamily: "'Sora', sans-serif" }}>{g.howTo}</div>
                  )}
                </>
              ) : (
                <>
                  {g.course && (
                    <div style={{ fontSize: 11, color: T.gray600, lineHeight: 1.5, fontFamily: "'Sora', sans-serif" }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", color: T.gray500, fontSize: 10 }}>📚 COURSE  </span>
                      {g.course}
                    </div>
                  )}
                  {g.exampleProject && (
                    <div style={{ fontSize: 11, color: T.gray600, lineHeight: 1.5, fontFamily: "'Sora', sans-serif" }}>
                      <span style={{ fontFamily: "'DM Mono', monospace", color: T.gray500, fontSize: 10 }}>🔧 BUILD  </span>
                      {g.exampleProject}
                    </div>
                  )}
                  {!g.course && !g.exampleProject && (
                    <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'Sora', sans-serif" }}>Research and practice this skill</div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

// ─── Your Projects ────────────────────────────────────────────────────────────
const hr = (r) => r * 1.5; // halo radius from inner radius

const YourProjects = () => {
  const W = 900, H = 560;
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const frameRef = useRef(null);
  const tickRef = useRef(null);
  const [renderNodes, setRenderNodes] = useState([]);
  const [renderEdges, setRenderEdges] = useState([]);
  const [form, setForm] = useState({ name: "", skills: "" });
  const [selected, setSelected] = useState(null);
  const [addSkillInput, setAddSkillInput] = useState("");

  // Build initial graph from static projects data
  useEffect(() => {
    const ns = [];
    const es = [];
    const seen = {};
    // Count how many projects each skill appears in
    const freqCount = {};
    projects.forEach(p => p.skills.forEach(s => { freqCount[s] = (freqCount[s] || 0) + 1; }));

    projects.forEach((p, pi) => {
      const pId = `p-${p.id}`;
      const angle = (pi / projects.length) * Math.PI * 2;
      const r = Math.min(14, Math.round(7 + p.skills.length * 1.2));
      ns.push({
        id: pId, type: "project", label: p.name,
        x: W / 2 + Math.cos(angle) * 320,
        y: H / 2 + Math.sin(angle) * 220,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r,
      });
      p.skills.forEach(skill => {
        const sId = `s-${skill}`;
        if (!seen[skill]) {
          seen[skill] = true;
          const freq = freqCount[skill] || 1;
          const sa = Math.random() * Math.PI * 2;
          ns.push({
            id: sId, type: "skill", label: skill,
            x: W / 2 + Math.cos(sa) * (120 + Math.random() * 310),
            y: H / 2 + Math.sin(sa) * (90 + Math.random() * 220),
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            r: Math.round(4 + freq * 1.5),
            freq,
          });
        }
        es.push({ source: pId, target: sId });
      });
    });
    nodesRef.current = ns;
    edgesRef.current = es;
    setRenderEdges([...es]);
  }, []);

  // Physics simulation loop
  useEffect(() => {
    const tick = () => {
      const ns = nodesRef.current;
      if (!ns.length) { frameRef.current = requestAnimationFrame(tick); return; }

      const fx = Array(ns.length).fill(0);
      const fy = Array(ns.length).fill(0);

      // Node-node repulsion (using halo radius for spacing)
      for (let i = 0; i < ns.length; i++) {
        for (let j = i + 1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x;
          const dy = ns[j].y - ns[i].y;
          const d2 = dx * dx + dy * dy || 0.01;
          const d = Math.sqrt(d2);
          const minD = hr(ns[i].r) + hr(ns[j].r) + 14;
          if (d < minD * 2.5) {
            const f = (minD * minD) / (d2 * d) * 0.55;
            fx[i] -= dx * f; fy[i] -= dy * f;
            fx[j] += dx * f; fy[j] += dy * f;
          }
        }
      }

      // Edge spring attraction
      const idxMap = {};
      ns.forEach((n, i) => { idxMap[n.id] = i; });
      edgesRef.current.forEach(e => {
        const si = idxMap[e.source], ti = idxMap[e.target];
        if (si == null || ti == null) return;
        const dx = ns[ti].x - ns[si].x;
        const dy = ns[ti].y - ns[si].y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.1;
        const ideal = 80 + hr(ns[si].r) + hr(ns[ti].r);
        const f = (d - ideal) * 0.022;
        const ux = dx / d, uy = dy / d;
        fx[si] += ux * f; fy[si] += uy * f;
        fx[ti] -= ux * f; fy[ti] -= uy * f;
      });

      // Integrate + center gravity + boundary clamp (using halo for bounds)
      let maxVel = 0;
      const next = ns.map((n, i) => {
        const gx = (W / 2 - n.x) * 0.0015;
        const gy = (H / 2 - n.y) * 0.0015;
        const nvx = (n.vx + fx[i] + gx) * 0.78;
        const nvy = (n.vy + fy[i] + gy) * 0.78;
        maxVel = Math.max(maxVel, Math.abs(nvx) + Math.abs(nvy));
        const h = hr(n.r);
        const nx = Math.max(h + 4, Math.min(W - h - 4, n.x + nvx));
        const ny = Math.max(h + 4, Math.min(H - h - 28, n.y + nvy));
        return { ...n, x: nx, y: ny, vx: nvx, vy: nvy };
      });

      nodesRef.current = next;
      setRenderNodes([...next]);
      // Only keep animating while nodes are still moving
      if (maxVel > 0.06) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };
    tickRef.current = tick;
    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  const restartSim = () => {
    cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(tickRef.current);
  };

  const addProject = () => {
    const name = form.name.trim();
    const skills = form.skills.split(",").map(s => s.trim()).filter(Boolean);
    if (!name || !skills.length) return;
    const pId = `p-custom-${Date.now()}`;
    const newNodes = [{
      id: pId, type: "project", label: name,
      x: W / 2 + (Math.random() - 0.5) * 160,
      y: H / 2 + (Math.random() - 0.5) * 120,
      vx: (Math.random() - 0.5), vy: (Math.random() - 0.5),
      r: Math.min(14, Math.round(7 + skills.length * 1.2)),
    }];
    const newEdges = [];
    skills.forEach(skill => {
      const sId = `s-${skill}`;
      if (!nodesRef.current.find(n => n.id === sId)) {
        newNodes.push({
          id: sId, type: "skill", label: skill,
          x: W / 2 + (Math.random() - 0.5) * 300,
          y: H / 2 + (Math.random() - 0.5) * 220,
          vx: (Math.random() - 0.5), vy: (Math.random() - 0.5),
          r: Math.round(4 + 1 * 1.5), freq: 1,
        });
      }
      newEdges.push({ source: pId, target: sId });
    });
    nodesRef.current = [...nodesRef.current, ...newNodes];
    edgesRef.current = [...edgesRef.current, ...newEdges];
    setRenderEdges([...edgesRef.current]);
    setForm({ name: "", skills: "" });
    restartSim();
  };

  const addSkillToProject = (projectId, skillName) => {
    const name = skillName.trim();
    if (!name) return;
    const sId = `s-${name}`;
    if (edgesRef.current.some(e => e.source === projectId && e.target === sId)) return;
    const extraNodes = [];
    if (!nodesRef.current.find(n => n.id === sId)) {
      const proj = nodesRef.current.find(n => n.id === projectId);
      extraNodes.push({
        id: sId, type: "skill", label: name,
        x: (proj?.x || W / 2) + (Math.random() - 0.5) * 80,
        y: (proj?.y || H / 2) + (Math.random() - 0.5) * 60,
        vx: (Math.random() - 0.5), vy: (Math.random() - 0.5),
        r: Math.round(4 + 1 * 1.5), freq: 1,
      });
    }
    const skillCount = edgesRef.current.filter(e => e.source === projectId).length + 1;
    // After adding edge, recount freq for this skill
    edgesRef.current = [...edgesRef.current, { source: projectId, target: sId }];
    const newFreq = edgesRef.current.filter(e => e.target === sId).length;
    nodesRef.current = [
      ...nodesRef.current.map(n => {
        if (n.id === projectId) return { ...n, r: Math.min(14, Math.round(7 + skillCount * 1.2)) };
        if (n.id === sId) return { ...n, r: Math.round(4 + newFreq * 1.5), freq: newFreq };
        return n;
      }),
      ...extraNodes,
    ];
    setRenderEdges([...edgesRef.current]);
    setAddSkillInput("");
    restartSim();
  };

  const deleteNode = (id) => {
    const node = nodesRef.current.find(n => n.id === id);
    if (!node) return;
    let newNodes = nodesRef.current.filter(n => n.id !== id);
    let newEdges = edgesRef.current.filter(e => e.source !== id && e.target !== id);
    if (node.type === "project") {
      const stillConnected = new Set();
      newEdges.forEach(e => { stillConnected.add(e.source); stillConnected.add(e.target); });
      newNodes = newNodes.filter(n => n.type === "project" || stillConnected.has(n.id));
    }
    // Recalculate skill freq + r from remaining edges
    const freqMap = {};
    newEdges.forEach(e => { freqMap[e.target] = (freqMap[e.target] || 0) + 1; });
    newNodes = newNodes.map(n => {
      if (n.type !== "skill") return n;
      const freq = freqMap[n.id] || 1;
      return { ...n, freq, r: Math.round(4 + freq * 1.5) };
    });
    nodesRef.current = newNodes;
    edgesRef.current = newEdges;
    setRenderNodes([...newNodes]);
    setRenderEdges([...newEdges]);
    setSelected(null);
    restartSim();
  };

  const nodePos = {};
  renderNodes.forEach(n => { nodePos[n.id] = n; });

  // Inline popup (avoids component remount)
  let popup = null;
  if (selected) {
    const sn = renderNodes.find(n => n.id === selected.id);
    if (sn) {
      const pw = 158, ph = selected.type === "project" ? 88 : 50;
      const h = hr(sn.r);
      const px = sn.x + h + 8 + pw > W ? sn.x - h - pw - 8 : sn.x + h + 8;
      const py = Math.max(4, Math.min(sn.y - ph / 2, H - ph - 4));
      popup = (
        <foreignObject x={px} y={py} width={pw} height={ph} onClick={e => e.stopPropagation()}>
          <div style={{ background: "#fff", border: `1px solid ${T.gray200}`, borderRadius: 8, padding: "8px 10px", boxShadow: "0 3px 14px rgba(0,0,0,0.11)", display: "flex", flexDirection: "column", gap: 6 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sn.label}</div>
            {selected.type === "project" && (
              <div style={{ display: "flex", gap: 4 }}>
                <input autoFocus placeholder="Add skill…" value={addSkillInput}
                  onChange={e => setAddSkillInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addSkillToProject(selected.id, addSkillInput)}
                  style={{ flex: 1, minWidth: 0, padding: "3px 6px", borderRadius: 5, border: `1px solid ${T.gray200}`, fontSize: 10, outline: "none", background: T.gray100, fontFamily: "'Sora', sans-serif" }}
                />
                <button onClick={() => addSkillToProject(selected.id, addSkillInput)}
                  style={{ padding: "3px 7px", borderRadius: 5, background: T.orange, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>+</button>
              </div>
            )}
            <button onClick={() => deleteNode(selected.id)}
              style={{ padding: "4px 8px", borderRadius: 5, background: "#FFF0EE", border: "1px solid #FFCAC4", color: "#D93025", fontSize: 10, fontWeight: 600, cursor: "pointer", textAlign: "left", fontFamily: "'Sora', sans-serif" }}>
              Delete {selected.type === "project" ? "project" : "skill"}
            </button>
          </div>
        </foreignObject>
      );
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 64, lineHeight: 0.9, color: T.black, letterSpacing: 3 }}>YOUR</div>
          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 64, lineHeight: 0.9, color: T.orange, letterSpacing: 3 }}>PROJECTS</div>
        </div>
        <div style={{ display: "flex", gap: 20, alignItems: "center", paddingBottom: 8 }}>
          {/* Legend: halo + inner preview */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="28" height="28" viewBox="-14 -14 28 28">
              <circle r={13} fill="#E8E4DF" />
              <circle r={8} fill="#2C2C2C" />
            </svg>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: T.gray600, textTransform: "uppercase", letterSpacing: 1 }}>Projects</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="18" height="18" viewBox="-9 -9 18 18">
              <circle r={8} fill="#E8E4DF" />
              <circle r={5} fill="#2C2C2C" />
            </svg>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: T.gray600, textTransform: "uppercase", letterSpacing: 1 }}>Skills</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="24" height="8"><line x1="0" y1="4" x2="24" y2="4" stroke="#AEAAA6" strokeWidth="1.2" strokeDasharray="5 4" /></svg>
            <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: T.gray600, textTransform: "uppercase", letterSpacing: 1 }}>Link</span>
          </div>
        </div>
      </div>

      {/* Simulation canvas */}
      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 16, background: "#FAFAF8" }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", cursor: "default" }}
          onClick={() => setSelected(null)}
        >
          {/* Dashed grey edges */}
          {renderEdges.map((e, i) => {
            const s = nodePos[e.source], t = nodePos[e.target];
            if (!s || !t) return null;
            return (
              <line key={i}
                x1={s.x | 0} y1={s.y | 0} x2={t.x | 0} y2={t.y | 0}
                stroke="#AEAAA6" strokeOpacity={0.75} strokeWidth={1}
                strokeDasharray="6 4"
              />
            );
          })}

          {/* Nodes: outer halo + inner dark circle + external label */}
          {renderNodes.map(n => {
            const isSel = selected?.id === n.id;
            const h = hr(n.r);
            // Break project labels onto multiple lines; skill labels single line
            const words = n.label.split(" ");
            const lines = n.type === "project" && words.length > 1
              ? (words.length <= 2
                  ? words
                  : [words.slice(0, Math.ceil(words.length / 2)).join(" "), words.slice(Math.ceil(words.length / 2)).join(" ")])
              : [n.label.length > 14 ? n.label.slice(0, 13) + "…" : n.label];
            const labelOffsetY = h + 12;
            return (
              <g key={n.id} transform={`translate(${n.x | 0},${n.y | 0})`}
                style={{ cursor: "pointer" }}
                onClick={e => { e.stopPropagation(); setSelected({ id: n.id, type: n.type }); setAddSkillInput(""); }}
              >
                {/* Outer halo */}
                <circle r={h}
                  fill={isSel ? `${T.orange}18` : "#E8E4DF"}
                  stroke={isSel ? T.orange : "none"}
                  strokeWidth={isSel ? 1.5 : 0}
                />
                {/* Inner dark core — skill opacity scales with frequency */}
                <circle r={n.r} fill="#2C2C2C"
                  fillOpacity={n.type === "skill" ? Math.min(1, 0.42 + (n.freq || 1) * 0.15) : 1}
                />
                {/* Label outside, below halo */}
                <text textAnchor="middle"
                  fontFamily="'Sora', sans-serif"
                  fontSize={n.type === "project" ? 10 : 9}
                  fill="#3C3C3C"
                  fontWeight={n.type === "project" ? 600 : 400}
                  style={{ pointerEvents: "none", userSelect: "none" }}
                >
                  {lines.map((line, li) => (
                    <tspan key={li} x={0} dy={li === 0 ? labelOffsetY : 13}>{line}</tspan>
                  ))}
                </text>
              </g>
            );
          })}

          {popup}
        </svg>
      </Card>

      {/* Add project form */}
      <Card style={{ padding: "20px 24px" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: T.gray400, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>Add to Playground</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input placeholder="Project name" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            style={{ flex: "1 1 150px", padding: "10px 14px", borderRadius: 10, border: `1px solid ${T.gray200}`, background: T.gray100, fontSize: 13, fontFamily: "'Sora', sans-serif", color: T.black, outline: "none" }}
          />
          <input placeholder="Skills, comma separated (e.g. Python, FastAPI, Docker)" value={form.skills}
            onChange={e => setForm(f => ({ ...f, skills: e.target.value }))}
            onKeyDown={e => e.key === "Enter" && addProject()}
            style={{ flex: "3 1 260px", padding: "10px 14px", borderRadius: 10, border: `1px solid ${T.gray200}`, background: T.gray100, fontSize: 13, fontFamily: "'Sora', sans-serif", color: T.black, outline: "none" }}
          />
          <button onClick={addProject}
            style={{ padding: "10px 22px", borderRadius: 10, background: T.orange, border: "none", color: "#fff", fontSize: 13, fontFamily: "'Sora', sans-serif", fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
            + Add
          </button>
        </div>
      </Card>
    </div>
  );
};

// ─── Interview Prep ───────────────────────────────────────────────────────────
const InterviewPrepView = () => {
  const [prepSets, setPrepSets] = useState([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [practiced, setPracticed] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("questions"); // questions | culture | ask
  const diffColors = { Easy: { c: T.green, b: T.greenLight }, Medium: { c: T.amber, b: T.amberLight }, Hard: { c: T.red, b: T.redLight } };

  useEffect(() => {
    fetchInterviewPrep().then(data => {
      if (data && data.length > 0) setPrepSets(data);
      setLoading(false);
    });
  }, []);

  const active = prepSets[activeIdx];
  const questions = active?.questions || [];
  const cultureQA = active?.culture_qa || [];
  const questionsToAsk = active?.questions_to_ask || [];
  const practicedCount = questions.filter((_, i) => practiced[`${activeIdx}-${i}`]).length;

  if (loading) return <Card style={{ padding: 40, textAlign: "center", color: T.gray400 }}>Loading interview prep...</Card>;

  if (prepSets.length === 0) return (
    <Card style={{ padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 14, color: T.gray400, fontFamily: "'Sora', sans-serif" }}>No interview prep generated yet.</div>
      <div style={{ fontSize: 11, color: T.gray400, marginTop: 8, fontFamily: "'DM Mono', monospace" }}>Run Agent 4 after jobs score ≥ 80</div>
    </Card>
  );

  return (
    <div style={{ display: "flex", gap: 14, height: "calc(100vh - 140px)" }}>
      {/* Sidebar */}
      <Card style={{ width: 240, padding: "20px", flexShrink: 0, overflow: "auto" }}>
        <Label>Prep Sets ({prepSets.length})</Label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {prepSets.map((ip, idx) => {
            const qCount = (ip.questions || []).length;
            const doneCount = (ip.questions || []).filter((_, i) => practiced[`${idx}-${i}`]).length;
            return (
              <div key={ip.id} onClick={() => { setActiveIdx(idx); setActiveTab("questions"); }} style={{
                padding: "14px", borderRadius: 12, cursor: "pointer",
                background: activeIdx === idx ? T.orangeXLight : T.gray100,
                border: `1px solid ${activeIdx === idx ? T.orange : T.gray200}`,
                transition: "all 0.2s",
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif" }}>{ip.company}</div>
                <div style={{ fontSize: 10, color: T.gray400, marginBottom: 8, fontFamily: "'DM Mono', monospace" }}>{ip.title}</div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>{doneCount}/{qCount} done</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: scoreColor(ip.score), fontFamily: "'DM Mono', monospace" }}>{ip.score}%</span>
                </div>
                <div style={{ height: 3, background: T.gray200, borderRadius: 99 }}>
                  <div style={{ width: `${qCount > 0 ? (doneCount / qCount) * 100 : 0}%`, height: "100%", background: T.orange, borderRadius: 99 }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Detail panel */}
      <Card style={{ flex: 1, padding: "24px", overflow: "auto" }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: "'Bebas Neue', 'Anton', sans-serif", fontSize: 28, letterSpacing: "-0.01em", color: T.black }}>{active.company} — {active.title}</div>
          <div style={{ fontSize: 11, color: T.gray400, marginTop: 2, fontFamily: "'DM Mono', monospace" }}>
            Generated {active.generated_at ? new Date(active.generated_at).toLocaleDateString() : "—"} · {questions.length} questions · {practicedCount} practiced
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["questions", `Questions (${questions.length})`], ["culture", `Culture Q&A (${cultureQA.length})`], ["ask", `Ask Them (${questionsToAsk.length})`]].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id)} style={{
              padding: "6px 14px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11,
              fontFamily: "'DM Mono', monospace", fontWeight: 700,
              background: activeTab === id ? T.orange : T.gray100,
              color: activeTab === id ? "#fff" : T.gray400,
            }}>{label}</button>
          ))}
        </div>

        {/* Questions tab */}
        {activeTab === "questions" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {questions.map((q, i) => {
              const pKey = `${activeIdx}-${i}`;
              const isPracticed = !!practiced[pKey];
              const diff = q.difficulty || "Medium";
              const dc = diffColors[diff] || diffColors.Medium;
              return (
                <div key={i} style={{ padding: "16px 20px", background: T.gray100, borderRadius: 14, border: `1px solid ${isPracticed ? T.green + "44" : T.gray200}` }}>
                  <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "flex-start" }}>
                    <Tag color={dc.c} bg={dc.b}>{diff}</Tag>
                    {q.category && <Tag color={T.gray600} bg={T.gray200}>{q.category}</Tag>}
                    <span style={{ fontSize: 13, color: T.black, lineHeight: 1.5, fontFamily: "'Sora', sans-serif", fontWeight: 600 }}>Q{i+1}. {q.question}</span>
                  </div>
                  {q.star_framework && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
                      {[["S","Situation"], ["T","Task"], ["A","Action"], ["R","Result"]].map(([letter, name]) => (
                        <div key={name} style={{ padding: "10px 12px", background: "#fff", borderRadius: 10, border: `1px solid ${T.gray200}` }}>
                          <div style={{ fontSize: 9, color: T.orange, letterSpacing: "0.1em", textTransform: "uppercase", fontFamily: "'DM Mono', monospace", marginBottom: 4, fontWeight: 700 }}>{letter} — {name}</div>
                          <div style={{ fontSize: 10, color: T.gray600, fontFamily: "'Sora', sans-serif", lineHeight: 1.4 }}>{q.star_framework[name.toLowerCase()] || `Add your ${name.toLowerCase()}...`}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button onClick={() => setPracticed(p => ({ ...p, [pKey]: !isPracticed }))} style={{
                      padding: "4px 12px", borderRadius: 20, border: "none", cursor: "pointer", fontSize: 11,
                      fontFamily: "'DM Mono', monospace", fontWeight: 700,
                      background: isPracticed ? T.greenLight : T.gray200,
                      color: isPracticed ? T.green : T.gray400,
                    }}>{isPracticed ? "✓ Practiced" : "Mark practiced"}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Culture Q&A tab */}
        {activeTab === "culture" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {cultureQA.map((qa, i) => (
              <div key={i} style={{ padding: "16px 20px", background: T.gray100, borderRadius: 14, border: `1px solid ${T.gray200}` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif", marginBottom: 8 }}>Q: {qa.question}</div>
                <div style={{ fontSize: 12, color: T.gray600, fontFamily: "'Sora', sans-serif", lineHeight: 1.6 }}>{qa.answer}</div>
              </div>
            ))}
          </div>
        )}

        {/* Ask them tab */}
        {activeTab === "ask" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace", marginBottom: 4 }}>Questions to ask the interviewer:</div>
            {questionsToAsk.map((q, i) => (
              <div key={i} style={{ padding: "14px 18px", background: T.gray100, borderRadius: 12, border: `1px solid ${T.gray200}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 11, color: T.orange, fontFamily: "'DM Mono', monospace", fontWeight: 700, flexShrink: 0 }}>{String(i+1).padStart(2,"0")}</span>
                <span style={{ fontSize: 13, color: T.black, fontFamily: "'Sora', sans-serif", lineHeight: 1.5 }}>{q}</span>
              </div>
            ))}
          </div>
        )}
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

// ─── Automation Logs ──────────────────────────────────────────────────────────
// ─── Agent Runner ─────────────────────────────────────────────────────────────
const AGENTS = [
  { id: 1, label: "Agent 1",  name: "Job Scraper",     endpoint: "/run/agent1", color: T.orange },
  { id: 2, label: "Agent 2",  name: "CV Matcher",      endpoint: "/run/agent2", color: T.green  },
  { id: 3, label: "Agent 3",  name: "Gap Analyst",     endpoint: "/run/agent3", color: T.amber  },
  { id: 4, label: "Agent 4",  name: "Interview Coach", endpoint: "/run/agent4", color: "#8B5CF6" },
  { id: 5, label: "Agent 5",  name: "Reporter",        endpoint: "/run/agent5", color: T.navy   },
  { id: 6, label: "Agent 6",  name: "App Tracker",     endpoint: "/run/agent6", color: T.gray600 },
];

const AgentRunner = () => {
  const { API } = useData();
  const { token } = useAuth();
  const [running, setRunning] = useState({});   // { [agentId]: true }
  const [results, setResults] = useState({});   // { [agentId]: { ok, msg } }

  const runAgent = async (agent) => {
    setRunning(p => ({ ...p, [agent.id]: true }));
    setResults(p => ({ ...p, [agent.id]: null }));
    try {
      const res = await fetch(`${API}${agent.endpoint}`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
      const data = await res.json();
      const ok = res.ok && data.status !== "error";
      const msg = ok
        ? (data.result ? `${Array.isArray(data.result) ? data.result.length : ""} jobs processed`.trim() : "Done")
        : (data.detail || data.error || "Failed");
      setResults(p => ({ ...p, [agent.id]: { ok, msg } }));
    } catch (e) {
      setResults(p => ({ ...p, [agent.id]: { ok: false, msg: e.message } }));
    }
    setRunning(p => ({ ...p, [agent.id]: false }));
  };

  return (
    <Card style={{ padding: "24px 28px", marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <Label>Run Agents</Label>
        <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: T.gray400 }}>local · triggers pipeline steps manually</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {AGENTS.map(agent => {
          const isRunning = running[agent.id];
          const result = results[agent.id];
          return (
            <div key={agent.id} style={{ border: `1px solid ${T.gray200}`, borderRadius: 12, padding: "14px 16px", background: T.gray100 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: agent.color + "22", color: agent.color }}>{agent.label}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif" }}>{agent.name}</span>
              </div>
              <button
                onClick={() => runAgent(agent)}
                disabled={isRunning}
                style={{
                  width: "100%", padding: "8px", borderRadius: 8, border: "none",
                  background: isRunning ? T.gray200 : agent.color,
                  color: isRunning ? T.gray400 : "#fff",
                  fontFamily: "'DM Mono', monospace", fontWeight: 700, fontSize: 11,
                  cursor: isRunning ? "wait" : "pointer", transition: "all 0.15s",
                }}
              >
                {isRunning ? "⏳ Running..." : "▶ Run"}
              </button>
              {result && (
                <div style={{ marginTop: 8, fontSize: 10, fontFamily: "'DM Mono', monospace", color: result.ok ? T.green : T.red, lineHeight: 1.4 }}>
                  {result.ok ? "✓" : "✗"} {result.msg}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
};

const AutomationLogs = () => {
  const { API } = useData();
  const { token } = useAuth();
  const [runs, setRuns] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API}/data/automation-logs`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.json())
      .then(d => {
        const raw = d.runs || [];
        // Group individual agent rows into pipeline runs by 2-hour window
        const sorted = [...raw].sort((a, b) => new Date(a.run_started_at) - new Date(b.run_started_at));
        const groups = [];
        let cur = null;
        for (const run of sorted) {
          const t = new Date(run.run_started_at);
          if (!cur || t - new Date(cur.run_started_at) > 2 * 60 * 60 * 1000) {
            if (cur) groups.push(cur);
            cur = { run_id: run.run_id, run_started_at: run.run_started_at, run_completed_at: run.run_completed_at, agents: [...(run.agents || [])] };
          } else {
            cur.agents.push(...(run.agents || []));
            cur.run_completed_at = run.run_completed_at;
          }
        }
        if (cur) groups.push(cur);
        const withStatus = groups.reverse().map(g => ({
          ...g,
          all_passed: g.agents.every(a => a.status === "success"),
          any_failed: g.agents.some(a => a.status === "failed"),
        }));
        setRuns(withStatus);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [API]);

  const fmt = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  const duration = (start, end) => {
    if (!start || !end) return null;
    const s = Math.round((new Date(end) - new Date(start)) / 1000);
    return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
  };

  const statusDot = (status) => {
    const map = { success: T.green, failed: T.red, running: T.amber, skipped: T.gray400 };
    return <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: map[status] || T.gray400, marginRight: 6, flexShrink: 0 }} />;
  };

  if (loading) return <Card style={{ padding: 32 }}><div style={{ color: T.gray400, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>Loading automation logs...</div></Card>;

  if (!runs.length) return (
    <Card style={{ padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
      <div style={{ fontFamily: "'Sora', sans-serif", color: T.gray600, fontSize: 13 }}>No automation runs logged yet.</div>
      <div style={{ fontFamily: "'DM Mono', monospace", color: T.gray400, fontSize: 11, marginTop: 6 }}>Runs will appear here after agents execute via API or n8n.</div>
    </Card>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {runs.map((run) => {
        const isOpen = expanded === run.run_id;
        const anyFailed = run.any_failed;
        const allPassed = run.all_passed;
        const runStatus = anyFailed ? "failed" : allPassed ? "success" : "running";
        const runColor = anyFailed ? T.red : allPassed ? T.green : T.amber;
        const runBg = anyFailed ? T.redLight : allPassed ? T.greenLight : T.amberLight;
        const agents = Array.isArray(run.agents) ? run.agents : [];

        return (
          <Card key={run.run_id} style={{ padding: 0, overflow: "hidden" }}>
            {/* Run header */}
            <button
              onClick={() => setExpanded(isOpen ? null : run.run_id)}
              style={{ width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", gap: 14, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
            >
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: runColor, flexShrink: 0, boxShadow: `0 0 6px ${runColor}88` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: T.black, letterSpacing: 1 }}>
                    {fmt(run.run_started_at)}
                  </span>
                  <span style={{ padding: "2px 8px", borderRadius: 6, fontSize: 10, fontFamily: "'DM Mono', monospace", fontWeight: 700, background: runBg, color: runColor, textTransform: "uppercase" }}>
                    {runStatus}
                  </span>
                  {duration(run.run_started_at, run.run_completed_at) && (
                    <span style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>
                      {duration(run.run_started_at, run.run_completed_at)}
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                  {agents.map((a, i) => (
                    <span key={i} style={{ display: "inline-flex", alignItems: "center", padding: "2px 8px", borderRadius: 20, fontSize: 10, fontFamily: "'DM Mono', monospace", background: a.status === "success" ? T.greenLight : a.status === "failed" ? T.redLight : T.amberLight, color: a.status === "success" ? T.green : a.status === "failed" ? T.red : T.amber }}>
                      {statusDot(a.status)}
                      {a.agent_name.split("—")[0].trim()}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ fontSize: 12, color: T.gray400, flexShrink: 0, transform: isOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</div>
            </button>

            {/* Expanded agent details */}
            {isOpen && (
              <div style={{ borderTop: `1px solid ${T.gray200}`, padding: "0 20px 16px" }}>
                {agents.map((a, i) => (
                  <div key={i} style={{ paddingTop: 14, borderBottom: i < agents.length - 1 ? `1px solid ${T.gray100}` : "none", paddingBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ paddingTop: 2 }}>{statusDot(a.status)}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13, color: T.black }}>{a.agent_name}</span>
                          <span style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>
                            {fmt(a.started_at)}{a.completed_at ? ` → ${duration(a.started_at, a.completed_at)}` : ""}
                          </span>
                        </div>
                        {/* Stats row */}
                        <div style={{ display: "flex", gap: 14, marginTop: 6, flexWrap: "wrap" }}>
                          {a.jobs_found != null && <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray600 }}>📥 {a.jobs_found} scraped</span>}
                          {a.jobs_scored != null && <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray600 }}>🔍 {a.jobs_scored} scored</span>}
                          {a.jobs_passed != null && <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray600 }}>✅ {a.jobs_passed} passed</span>}
                          {a.details && Object.entries(typeof a.details === "string" ? JSON.parse(a.details) : a.details).map(([k, v]) => (
                            <span key={k} style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray600 }}>{k}: {String(v)}</span>
                          ))}
                        </div>
                        {/* Error */}
                        {a.error_message && (
                          <div style={{ marginTop: 8, padding: "8px 12px", background: T.redLight, borderRadius: 8, border: `1px solid ${T.red}22` }}>
                            <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", fontWeight: 700, color: T.red, marginBottom: 2 }}>ERROR</div>
                            <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.red, lineHeight: 1.5, wordBreak: "break-word" }}>{a.error_message}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
};

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
      flexShrink: 0,
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
      <div style={{ padding: "12px 8px", flex: 1, overflow: "hidden" }}>
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

// ─── Scrapper ─────────────────────────────────────────────────────────────────
const SCRAPER_META = {
  arbeitsagentur: { label: "Arbeitsagentur", color: T.orange, icon: "🇩🇪" },
  linkedin:       { label: "LinkedIn",        color: T.green,  icon: "💼" },
  indeed:         { label: "Indeed",          color: T.navy,   icon: "🔍" },
};

const ScraperStats = () => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchScraperStats().then(d => { if (d) setStats(d); });
  }, []);

  const totals = stats?.totals || { arbeitsagentur: 0, linkedin: 0, indeed: 0 };
  const timeline = stats?.timeline || [];
  const totalAll = Object.values(totals).reduce((a, b) => a + b, 0);

  return (
    <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: 24, height: "100%", animation: "fadeUp 0.3s ease" }}>

      {/* ── Top: 3 scraper cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
        {Object.entries(SCRAPER_META).map(([key, meta]) => {
          const count = totals[key] || 0;
          const pct = totalAll > 0 ? Math.round((count / totalAll) * 100) : 0;
          return (
            <Card key={key} style={{ padding: "28px 28px 24px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray400, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
                    {meta.icon} {meta.label}
                  </div>
                  <div style={{ fontSize: 48, fontFamily: "'Bebas Neue', sans-serif", color: meta.color, lineHeight: 1 }}>
                    {count.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace", marginTop: 4 }}>
                    jobs scraped total
                  </div>
                </div>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  background: `${meta.color}18`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 20,
                }}>
                  {meta.icon}
                </div>
              </div>
              {/* share bar */}
              <div style={{ height: 4, borderRadius: 99, background: T.gray200, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${pct}%`, background: meta.color, borderRadius: 99, transition: "width 0.8s ease" }} />
              </div>
              <div style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono', monospace", marginTop: 6 }}>
                {pct}% of all scraped jobs
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── Bottom: timeline line chart ── */}
      <Card style={{ flex: 1, padding: "24px 24px 16px" }}>
        <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: T.gray400, textTransform: "uppercase", letterSpacing: 1, marginBottom: 20 }}>
          Jobs Scraped — Last 14 Days
        </div>
        {timeline.length === 0 ? (
          <EmptyState message="No timeline data yet" sub="Run the pipeline to populate this chart" />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={timeline} margin={{ top: 5, right: 24, left: 0, bottom: 5 }}>
              <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "'DM Mono', monospace", fill: T.gray400 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fontFamily: "'DM Mono', monospace", fill: T.gray400 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "rgba(255,255,255,0.95)", border: `1px solid ${T.gray200}`, borderRadius: 10, fontFamily: "'DM Mono', monospace", fontSize: 11 }}
                cursor={{ stroke: T.gray200 }}
              />
              <Legend wrapperStyle={{ fontSize: 11, fontFamily: "'DM Mono', monospace", paddingTop: 12 }} />
              {Object.entries(SCRAPER_META).map(([key, meta]) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={meta.label}
                  stroke={meta.color}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: meta.color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
};

// ─── Manual Applications Tracker ─────────────────────────────────────────────
const STATUS_OPTS = ["applied", "interview", "rejected", "offer"];
const STATUS_COLORS = {
  applied:   { bg: T.orangeXLight, color: T.orange },
  interview: { bg: T.amberLight,   color: T.amber },
  rejected:  { bg: T.redLight,     color: T.red },
  offer:     { bg: T.greenLight,   color: T.green },
};

const inputStyle = {
  width: "100%", padding: "10px 14px", borderRadius: 10,
  border: `1px solid #E8E8E8`, background: "rgba(255,255,255,0.8)",
  fontSize: 13, fontFamily: "'Sora', sans-serif", color: "#0D0D0D",
  outline: "none", transition: "border-color 0.15s", boxSizing: "border-box",
};

const ManualTracker = () => {
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  // form
  const [form, setForm] = useState({ title: "", company: "", description: "", url: "", notes: "" });
  const [formError, setFormError] = useState("");

  // split-panel view: null = overview, "applied"|"interview"|"rejected"|"offer" = panel open
  const [panelStatus, setPanelStatus] = useState(null);
  const [selected, setSelected] = useState(null);

  // cover letter modal state
  const [showCLModal, setShowCLModal] = useState(false);
  const [clTarget, setClTarget] = useState(null);
  const [clPreview, setClPreview] = useState(null);
  const [clLoading, setClLoading] = useState(false);
  const [clApproving, setClApproving] = useState(false);
  const [clDone, setClDone] = useState({});
  const [clError, setClError] = useState(null);

  // tailor CV modal state
  const [showTailorModal, setShowTailorModal] = useState(false);
  const [tailorTarget, setTailorTarget] = useState(null);
  const [tailorPreview, setTailorPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [tailoring, setTailoring] = useState(false);
  const [tailored, setTailored] = useState({});
  const [localAdd, setLocalAdd] = useState([]);
  const [localRemove, setLocalRemove] = useState([]);
  const [includeCoverLetter, setIncludeCoverLetter] = useState(true);
  const [tailorClPreview, setTailorClPreview] = useState(null);
  const [tailorClLoading, setTailorClLoading] = useState(false);
  const [tailorClApproving, setTailorClApproving] = useState(false);
  const [tailorClError, setTailorClError] = useState(null);

  const handleOpenCLModal = async (app) => {
    setClTarget(app);
    setClPreview(null);
    setClError(null);
    setShowCLModal(true);
  };

  const handleOpenTailorModal = async (app) => {
    setTailorTarget(app);
    setTailorPreview(null);
    setLocalAdd([]);
    setLocalRemove([]);
    setIncludeCoverLetter(true);
    setTailorClPreview(null);
    setTailorClError(null);
    setShowTailorModal(true);
    setPreviewLoading(true);
    try {
      const preview = await previewTailorCVManual(app.title, app.company, app.description || "");
      setTailorPreview(preview);
      setLocalAdd(preview?.skills_to_add || []);
      setLocalRemove(preview?.skills_to_remove || []);
    } catch (e) {
      console.error("[Tailor Preview manual]", e);
    }
    setPreviewLoading(false);
  };

  const handleRunTailor = async () => {
    if (!tailorTarget) return;
    setTailoring(true);
    try {
      const result = await tailorCVManual(tailorTarget.title, tailorTarget.company, tailorTarget.description || "", includeCoverLetter, localAdd, localRemove, tailorClPreview?.letter_text || null);
      setTailored(prev => ({ ...prev, [tailorTarget.id]: result }));
      setShowTailorModal(false);
    } catch (e) { console.error("[Tailor manual]", e); }
    setTailoring(false);
  };

  const handleTailorPreviewCL = async () => {
    if (!tailorTarget) return;
    setTailorClLoading(true);
    setTailorClError(null);
    try {
      const result = await previewCoverLetterManual(tailorTarget.title, tailorTarget.company, tailorTarget.description || "");
      setTailorClPreview(result);
    } catch (e) {
      setTailorClError("Failed to generate cover letter. Check API connection.");
    }
    setTailorClLoading(false);
  };

  const handleTailorApproveWithLetter = async () => {
    if (!tailorClPreview || !tailorTarget) return;
    setTailorClApproving(true);
    setTailoring(true);
    try {
      const result = await tailorCVManual(tailorTarget.title, tailorTarget.company, tailorTarget.description || "", true, localAdd, localRemove, tailorClPreview.letter_text);
      setTailored(prev => ({ ...prev, [tailorTarget.id]: result }));
      setShowTailorModal(false);
    } catch (e) { setTailorClError("Failed to generate ZIP. Check API connection."); }
    setTailorClApproving(false);
    setTailoring(false);
  };

  const handleGenerateCoverLetter = async () => {
    if (!clTarget) return;
    setClLoading(true);
    setClError(null);
    try {
      const result = await previewCoverLetterManual(clTarget.title, clTarget.company, clTarget.description || "");
      setClPreview(result);
    } catch (e) {
      console.error("[CL Preview manual]", e);
      setClError("Failed to generate cover letter. Check API connection.");
    }
    setClLoading(false);
  };

  const handleApproveCoverLetter = async () => {
    if (!clPreview || !clTarget) return;
    setClApproving(true);
    setClError(null);
    try {
      await approveCoverLetterManual(clTarget.title, clTarget.company, clPreview.letter_text);
      setClDone(prev => ({ ...prev, [clTarget.id]: true }));
      setShowCLModal(false);
      setClPreview(null);
    } catch (e) {
      console.error("[CL Approve manual]", e);
      setClError("Approve failed. Check API connection.");
    }
    setClApproving(false);
  };

  // resizable right panel
  const [detailWidth, setDetailWidth] = useState(() => Math.floor((window.innerWidth - 180) * 0.44));
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  useEffect(() => {
    const onMove = (e) => {
      if (!isResizing.current) return;
      const dx = startX.current - e.clientX;
      setDetailWidth(Math.min(Math.max(startWidth.current + dx, 280), 820));
    };
    const onUp = () => { isResizing.current = false; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, []);

  const load = () => {
    setLoading(true);
    fetchManualApplications().then(data => {
      setApps(data || []);
      setLoading(false);
    });
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.company.trim()) { setFormError("Title and company required."); return; }
    setFormError("");
    setSaving(true);
    try {
      await createManualApplication({
        title: form.title.trim(), company: form.company.trim(),
        description: form.description.trim() || null,
        url: form.url.trim() || null,
        notes: form.notes.trim() || null,
        status: "applied",
      });
      setForm({ title: "", company: "", description: "", url: "", notes: "" });
      load();
    } catch { setFormError("Failed to save. Check API connection."); }
    finally { setSaving(false); }
  };

  const handleStatusChange = async (appId, newStatus) => {
    setApps(prev => prev.map(a => a.id === appId ? { ...a, status: newStatus } : a));
    if (selected?.id === appId) setSelected(s => ({ ...s, status: newStatus }));
    try { await updateManualApplicationStatus(appId, newStatus); }
    catch { load(); }
  };

  const handleDelete = async (appId) => {
    try {
      await deleteManualApplication(appId);
      setApps(prev => prev.filter(a => a.id !== appId));
      if (selected?.id === appId) setSelected(null);
      setConfirmDelete(null);
    } catch { console.warn("Delete failed"); }
  };

  const grouped = STATUS_OPTS.reduce((acc, s) => { acc[s] = apps.filter(a => a.status === s); return acc; }, {});
  const fmtDate = (str) => { if (!str) return "—"; const d = new Date(str); return isNaN(d) ? str.slice(0,10) : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); };

  // ── Overview mode ────────────────────────────────────────────────────────────
  if (!panelStatus) return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Add form */}
      <Card style={{ padding: "28px 32px" }}>
        <Label>Track New Application</Label>
        <form onSubmit={handleAdd}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray400, marginBottom: 4 }}>JOB TITLE *</div>
              <input style={inputStyle} placeholder="e.g. AI Engineer" value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                onFocus={e => e.target.style.borderColor = T.orange} onBlur={e => e.target.style.borderColor = T.gray200} />
            </div>
            <div>
              <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray400, marginBottom: 4 }}>COMPANY *</div>
              <input style={inputStyle} placeholder="e.g. Allianz" value={form.company}
                onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                onFocus={e => e.target.style.borderColor = T.orange} onBlur={e => e.target.style.borderColor = T.gray200} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray400, marginBottom: 4 }}>JOB LINK (OPTIONAL)</div>
            <input style={inputStyle} placeholder="https://..." value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              onFocus={e => e.target.style.borderColor = T.orange} onBlur={e => e.target.style.borderColor = T.gray200} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray400, marginBottom: 4 }}>JOB DESCRIPTION</div>
            <textarea style={{ ...inputStyle, height: 110, resize: "vertical" }} placeholder="Paste the job description here..."
              value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              onFocus={e => e.target.style.borderColor = T.orange} onBlur={e => e.target.style.borderColor = T.gray200} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray400, marginBottom: 4 }}>NOTES</div>
            <input style={inputStyle} placeholder="e.g. Referred by a friend, deadline next Friday..." value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              onFocus={e => e.target.style.borderColor = T.orange} onBlur={e => e.target.style.borderColor = T.gray200} />
          </div>
          {formError && <div style={{ fontSize: 11, color: T.red, fontFamily: "'DM Mono', monospace", marginBottom: 12 }}>{formError}</div>}
          <button type="submit" disabled={saving} style={{
            padding: "11px 28px", borderRadius: 10, border: "none",
            background: saving ? T.gray200 : T.orange, color: saving ? T.gray400 : "#fff",
            fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13,
            cursor: saving ? "not-allowed" : "pointer", transition: "background 0.15s",
          }}>{saving ? "Saving..." : "Track Application"}</button>
        </form>
      </Card>

      {/* Stat cards — clickable */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
        {STATUS_OPTS.map(s => {
          const sc = STATUS_COLORS[s];
          const count = grouped[s].length;
          return (
            <Card key={s} onClick={() => { setPanelStatus(s); setSelected(null); }} style={{
              padding: "20px 24px", cursor: "pointer",
              transition: "all 0.2s cubic-bezier(0.34,1.56,0.64,1)",
            }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 6px 24px ${sc.color}22`; e.currentTarget.style.borderColor = sc.color; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = ""; e.currentTarget.style.borderColor = ""; }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", letterSpacing: "0.1em", textTransform: "uppercase", color: T.gray400 }}>{s}</div>
                <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", color: sc.color, background: sc.bg, padding: "2px 7px", borderRadius: 99 }}>View →</span>
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 52, lineHeight: 1, color: sc.color }}>{count}</div>
            </Card>
          );
        })}
      </div>

      {/* All applications flat list (small) */}
      {loading ? (
        <Card style={{ padding: "32px", textAlign: "center" }}>
          <div style={{ fontSize: 12, fontFamily: "'DM Mono', monospace", color: T.gray400 }}>Loading...</div>
        </Card>
      ) : apps.length === 0 ? (
        <EmptyState message="No applications tracked yet" sub="Add your first one above" />
      ) : (
        <Card style={{ padding: "20px 24px" }}>
          <Label>All Applications ({apps.length})</Label>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {apps.map(app => {
              const sc = STATUS_COLORS[app.status] || STATUS_COLORS.applied;
              return (
                <div key={app.id} onClick={() => { setPanelStatus(app.status); setSelected(app); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, cursor: "pointer", background: T.gray100, border: `1px solid ${T.gray200}`, transition: "all 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = sc.color; e.currentTarget.style.background = sc.bg; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = T.gray200; e.currentTarget.style.background = T.gray100; }}
                >
                  <span style={{ fontSize: 9, fontFamily: "'DM Mono', monospace", padding: "3px 9px", borderRadius: 99, background: sc.bg, color: sc.color, textTransform: "capitalize", flexShrink: 0, fontWeight: 600 }}>{app.status}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{app.title}</div>
                    <div style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>{app.company} · {fmtDate(app.created_at)}</div>
                  </div>
                  <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>→</div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );

  // ── Split-panel mode ─────────────────────────────────────────────────────────
  const filtered = apps.filter(a => a.status === panelStatus);
  const sc = STATUS_COLORS[panelStatus];

  return (
    <>
    <div style={{ display: "flex", flexDirection: "column", gap: 0, height: "calc(100vh - 140px)" }}>
      {/* Breadcrumb bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, flexShrink: 0 }}>
        <button onClick={() => { setPanelStatus(null); setSelected(null); }} style={{
          background: T.gray100, border: `1px solid ${T.gray200}`, borderRadius: 8,
          padding: "6px 14px", fontSize: 11, fontFamily: "'DM Mono', monospace",
          color: T.gray600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
        }}>← Overview</button>
        <div style={{ width: 1, height: 16, background: T.gray200 }} />
        {STATUS_OPTS.map(s => {
          const ssc = STATUS_COLORS[s];
          const active = s === panelStatus;
          return (
            <button key={s} onClick={() => { setPanelStatus(s); setSelected(null); }} style={{
              padding: "5px 14px", borderRadius: 99, fontSize: 10, fontFamily: "'DM Mono', monospace",
              cursor: "pointer", transition: "all 0.15s",
              background: active ? ssc.color : T.gray100,
              border: `1px solid ${active ? ssc.color : T.gray200}`,
              color: active ? "#fff" : T.gray600,
            }}>
              {s.charAt(0).toUpperCase() + s.slice(1)} ({grouped[s].length})
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div style={{ display: "flex", gap: 14, flex: 1, minHeight: 0 }}>
        {/* Left — list */}
        <Card style={{ flex: 1, padding: "20px", overflow: "auto", minWidth: 0 }}>
          {filtered.length === 0 ? (
            <EmptyState message={`No ${panelStatus} applications`} sub="Add one from the form above" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(app => {
                const isSel = selected?.id === app.id;
                return (
                  <div key={app.id} onClick={() => setSelected(app)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                      borderRadius: 12, cursor: "pointer",
                      background: isSel ? sc.bg : T.gray100,
                      border: `1px solid ${isSel ? sc.color : T.gray200}`,
                      transition: "all 0.18s",
                    }}
                    onMouseEnter={e => { if (!isSel) { e.currentTarget.style.borderColor = sc.color; e.currentTarget.style.background = sc.bg + "88"; } }}
                    onMouseLeave={e => { if (!isSel) { e.currentTarget.style.borderColor = T.gray200; e.currentTarget.style.background = T.gray100; } }}
                  >
                    {/* Company initial avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: isSel ? sc.color : T.gray200,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: isSel ? "#fff" : T.gray600,
                    }}>{app.company?.[0]?.toUpperCase() || "?"}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{app.title}</div>
                      <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>{app.company} · {fmtDate(app.created_at)}</div>
                    </div>
                    {app.url && <div style={{ fontSize: 10, color: sc.color, fontFamily: "'DM Mono', monospace", flexShrink: 0 }}>↗</div>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Right — detail (resizable) */}
        <div style={{ position: "relative", width: detailWidth, flexShrink: 0 }}>
          {/* Resize handle */}
          <div onMouseDown={e => { isResizing.current = true; startX.current = e.clientX; startWidth.current = detailWidth; e.preventDefault(); }}
            style={{ position: "absolute", left: -4, top: 0, bottom: 0, width: 8, cursor: "col-resize", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 3, height: 32, borderRadius: 99, background: T.gray200 }} />
          </div>

          <Card style={{ width: "100%", height: "100%", padding: 0, overflow: "hidden", boxSizing: "border-box" }}>
            {!selected ? (
              <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
                <div style={{ fontSize: 32, color: T.gray200 }}>◻</div>
                <div style={{ fontSize: 12, color: T.gray400, fontFamily: "'DM Mono', monospace", textAlign: "center" }}>Select an application<br/>to see details</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", padding: "28px", boxSizing: "border-box" }}>
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexShrink: 0 }}>
                  <div>
                    {/* Company avatar large */}
                    <div style={{
                      width: 56, height: 56, borderRadius: 14, marginBottom: 14,
                      background: `linear-gradient(135deg, ${sc.color}22, ${sc.color}44)`,
                      border: `1px solid ${sc.color}44`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: sc.color,
                    }}>{selected.company?.[0]?.toUpperCase() || "?"}</div>
                    <div style={{ fontFamily: "'Bebas Neue', 'Anton', sans-serif", fontSize: 26, lineHeight: 1.1, color: T.black, letterSpacing: "-0.01em" }}>{selected.title}</div>
                    <div style={{ fontSize: 13, color: T.gray600, fontFamily: "'DM Mono', monospace", marginTop: 4 }}>{selected.company}</div>
                    <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace", marginTop: 2 }}>Added {fmtDate(selected.created_at)}</div>
                  </div>
                  <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: T.gray400, cursor: "pointer", fontSize: 18 }}>✕</button>
                </div>

                {/* Status + URL + Tailor row */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexShrink: 0, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", padding: "5px 12px", borderRadius: 99, background: sc.bg, color: sc.color, fontWeight: 600, textTransform: "capitalize" }}>{selected.status}</span>
                  {selected.url && (
                    <a href={selected.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: T.orange, fontFamily: "'DM Mono', monospace", textDecoration: "none", padding: "5px 12px", borderRadius: 99, background: T.orangeXLight, border: `1px solid ${T.orange}33` }}>
                      View Job ↗
                    </a>
                  )}
                  <button
                    onClick={() => handleOpenTailorModal(selected)}
                    style={{
                      fontSize: 11, padding: "5px 14px", borderRadius: 99, cursor: "pointer",
                      fontFamily: "'DM Mono', monospace", fontWeight: 700,
                      background: tailored[selected.id] ? T.greenLight : T.orangeXLight,
                      border: `1px solid ${tailored[selected.id] ? T.green : T.orange}44`,
                      color: tailored[selected.id] ? T.green : T.orange,
                      transition: "all 0.15s",
                    }}
                  >
                    {tailored[selected.id] ? "✓ CV Tailored" : "✂ Tailor CV"}
                  </button>
                  <button
                    onClick={() => handleOpenCLModal(selected)}
                    style={{
                      fontSize: 11, padding: "5px 14px", borderRadius: 99, cursor: "pointer",
                      fontFamily: "'DM Mono', monospace", fontWeight: 700,
                      background: clDone[selected.id] ? "#dcfce7" : "#1a1a2e",
                      border: "none", color: clDone[selected.id] ? "#16a34a" : "#fff",
                      transition: "all 0.15s",
                    }}
                  >
                    {clDone[selected.id] ? "✓ Letter Ready" : "✉ Cover Letter"}
                  </button>
                </div>

                {/* Change status */}
                <div style={{ marginBottom: 20, flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: T.gray400, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Move to</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {STATUS_OPTS.filter(s => s !== selected.status).map(s => {
                      const ssc = STATUS_COLORS[s];
                      return (
                        <button key={s} onClick={() => handleStatusChange(selected.id, s)} style={{
                          fontSize: 10, padding: "5px 14px", borderRadius: 99, cursor: "pointer",
                          fontFamily: "'DM Mono', monospace", background: ssc.bg,
                          border: `1px solid ${ssc.color}44`, color: ssc.color,
                          transition: "all 0.15s",
                        }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                      );
                    })}
                  </div>
                  {selected.status === "interview" && (
                    <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: T.amberLight, border: `1px solid ${T.amber}44` }}>
                      <div style={{ fontSize: 11, color: T.amber, fontFamily: "'DM Mono', monospace" }}>Interview Prep generating — check Interview Prep tab soon.</div>
                    </div>
                  )}
                </div>

                {/* Description */}
                {selected.description && (
                  <div style={{ marginBottom: 20, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: T.gray400, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Job Description</div>
                    <div style={{ fontSize: 12, color: T.gray600, fontFamily: "'Sora', sans-serif", lineHeight: 1.7, whiteSpace: "pre-wrap", background: T.gray100, borderRadius: 10, padding: "14px 16px" }}>{selected.description}</div>
                  </div>
                )}

                {/* Notes */}
                {selected.notes && (
                  <div style={{ marginBottom: 20, flexShrink: 0 }}>
                    <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: T.gray400, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Notes</div>
                    <div style={{ fontSize: 12, color: T.gray600, fontFamily: "'Sora', sans-serif", background: T.gray100, borderRadius: 10, padding: "12px 16px" }}>{selected.notes}</div>
                  </div>
                )}

                {/* Delete */}
                <div style={{ marginTop: "auto", paddingTop: 16, borderTop: `1px solid ${T.gray200}`, flexShrink: 0 }}>
                  {confirmDelete === selected.id ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => handleDelete(selected.id)} style={{ fontSize: 11, padding: "7px 16px", borderRadius: 8, border: "none", background: T.red, color: "#fff", cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>Confirm Delete</button>
                      <button onClick={() => setConfirmDelete(null)} style={{ fontSize: 11, padding: "7px 16px", borderRadius: 8, border: `1px solid ${T.gray200}`, background: T.white, color: T.gray600, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(selected.id)} style={{ fontSize: 11, padding: "7px 16px", borderRadius: 8, border: `1px solid ${T.gray200}`, background: T.white, color: T.gray400, cursor: "pointer", fontFamily: "'DM Mono', monospace" }}>Delete Application</button>
                  )}
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>

    {/* ── Tailor CV Modal ── */}
    {showTailorModal && tailorTarget && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: 560, maxHeight: "88vh", overflow: "auto", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
          <button onClick={() => setShowTailorModal(false)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 18, color: T.gray400, cursor: "pointer" }}>✕</button>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.black, fontFamily: "'Sora', sans-serif", marginBottom: 4 }}>CV Tailoring</div>
          <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace", marginBottom: 24 }}>{tailorTarget.title} @ {tailorTarget.company}</div>

          {previewLoading ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: T.gray400, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>⏳ Analyzing job requirements...</div>
          ) : tailorPreview ? (
            <>
              {/* Skills to add */}
              {localAdd.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: T.gray400, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Skills to Add</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {localAdd.map(s => (
                      <span key={s} onClick={() => setLocalAdd(prev => prev.filter(x => x !== s))} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: T.greenLight, color: T.green, cursor: "pointer", fontFamily: "'DM Mono', monospace", border: `1px solid ${T.green}44` }} title="Click to remove">+ {s}</span>
                    ))}
                  </div>
                </div>
              )}
              {/* Skills to remove */}
              {localRemove.length > 0 && (
                <div style={{ marginBottom: 20 }}>
                  <div style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: T.gray400, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Skills to Remove <span style={{ color: T.gray400, fontWeight: 400 }}>(click to keep)</span></div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {localRemove.map(s => (
                      <span key={s} onClick={() => setLocalRemove(prev => prev.filter(x => x !== s))} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 99, background: T.redLight, color: T.red, cursor: "pointer", fontFamily: "'DM Mono', monospace", border: `1px solid ${T.red}44` }} title="Click to keep">− {s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Cover letter toggle */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <input type="checkbox" id="tailor-cl-manual" checked={includeCoverLetter} onChange={e => { setIncludeCoverLetter(e.target.checked); if (!e.target.checked) { setTailorClPreview(null); setTailorClError(null); } }} style={{ accentColor: T.orange, cursor: "pointer", width: 14, height: 14 }} />
                <label htmlFor="tailor-cl-manual" style={{ fontSize: 11, color: T.gray400, cursor: "pointer", fontFamily: "'DM Mono', monospace", userSelect: "none" }}>Include cover letter</label>
              </div>

              {/* Cover letter preview section */}
              {includeCoverLetter && (
                <div style={{ marginBottom: 16 }}>
                  <button onClick={handleTailorPreviewCL} disabled={tailorClLoading} style={{ padding: "8px 18px", borderRadius: 10, background: tailorClLoading ? T.gray200 : T.navy, border: "none", color: tailorClLoading ? T.gray400 : "#fff", fontWeight: 700, fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: tailorClLoading ? "wait" : "pointer", marginBottom: 10 }}>
                    {tailorClLoading ? "⏳ Generating letter..." : tailorClPreview ? "↺ Re-run Letter" : "✉ Preview Cover Letter"}
                  </button>
                  {tailorClPreview && (
                    <div style={{ border: `1px solid ${T.gray200}`, borderRadius: 12, padding: 14, background: "#fafafa" }}>
                      {tailorClPreview.scorecard && (
                        <div style={{ marginBottom: 10 }}>
                          {Object.entries(tailorClPreview.scorecard.scores || {}).map(([dim, score]) => (
                            <div key={dim} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                              <div style={{ fontSize: 9, color: T.gray400, fontFamily: "'DM Mono', monospace", width: 110, flexShrink: 0 }}>{dim.replace(/_/g, " ")}</div>
                              <div style={{ flex: 1, height: 4, background: T.gray200, borderRadius: 99 }}>
                                <div style={{ height: "100%", width: `${score * 10}%`, background: score >= 8 ? "#16a34a" : score >= 6 ? T.orange : T.red, borderRadius: 99 }} />
                              </div>
                              <div style={{ fontSize: 9, color: T.gray600, fontFamily: "'DM Mono', monospace", width: 14 }}>{score}</div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: T.gray600, fontFamily: "'Sora', sans-serif", lineHeight: 1.7, maxHeight: 160, overflowY: "auto", whiteSpace: "pre-wrap", padding: "10px 12px", background: "#fff", borderRadius: 8, border: `1px solid ${T.gray200}` }}>
                        {tailorClPreview.letter_text}
                      </div>
                      <button onClick={handleTailorApproveWithLetter} disabled={tailorClApproving || tailoring} style={{ marginTop: 10, width: "100%", padding: "9px", borderRadius: 9, background: "#16a34a", border: "none", color: "#fff", fontWeight: 700, fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: (tailorClApproving || tailoring) ? "wait" : "pointer" }}>
                        {tailorClApproving || tailoring ? "⏳ Generating ZIP..." : "✓ Approve & Generate ZIP"}
                      </button>
                    </div>
                  )}
                  {tailorClError && <div style={{ fontSize: 11, color: T.red, fontFamily: "'DM Mono', monospace", marginTop: 8 }}>{tailorClError}</div>}
                </div>
              )}

              {/* Run button */}
              <button onClick={handleRunTailor} disabled={tailoring || tailorClLoading} style={{ width: "100%", padding: "14px", borderRadius: 12, background: T.orange, border: "none", color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: "'DM Mono', monospace", cursor: (tailoring || tailorClLoading) ? "wait" : "pointer", boxShadow: `0 4px 16px rgba(232,98,26,0.3)` }}>
                {tailoring ? "⏳ Tailoring CV..." : includeCoverLetter ? "✂ Tailor CV only (skip letter)" : "✂ Run Tailoring"}
              </button>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0", color: T.gray400, fontFamily: "'DM Mono', monospace", fontSize: 12 }}>No preview available — add a job description when tracking to enable tailoring.</div>
          )}
        </div>
      </div>
    )}

    {/* ── Cover Letter Modal ── */}
    {showCLModal && clTarget && (
      <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ background: "#fff", borderRadius: 20, padding: 32, width: 540, maxHeight: "85vh", overflow: "auto", position: "relative", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
          <button onClick={() => setShowCLModal(false)} style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", fontSize: 18, color: T.gray400, cursor: "pointer" }}>✕</button>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.black, fontFamily: "'Sora', sans-serif", marginBottom: 4 }}>Cover Letter</div>
          <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace", marginBottom: 24 }}>{clTarget.title} @ {clTarget.company}</div>

          {/* Generate button (shown when no preview yet) */}
          {!clPreview && (
            <button onClick={handleGenerateCoverLetter} disabled={clLoading} style={{ width: "100%", padding: "14px", borderRadius: 12, background: clLoading ? T.gray200 : "#1a1a2e", border: "none", color: clLoading ? T.gray400 : "#fff", fontWeight: 700, fontSize: 13, fontFamily: "'DM Mono', monospace", cursor: clLoading ? "wait" : "pointer", marginBottom: 8 }}>
              {clLoading ? "⏳ Generating letter..." : "✉ Generate Cover Letter"}
            </button>
          )}

          {clError && <div style={{ fontSize: 11, color: T.red, fontFamily: "'DM Mono', monospace", marginBottom: 8, padding: "8px 12px", background: T.redLight, borderRadius: 8 }}>{clError}</div>}

          {/* Letter preview + scorecard */}
          {clPreview && (
            <div style={{ border: `1px solid ${T.gray200}`, borderRadius: 12, padding: 16, background: "#fafafa" }}>
              {/* Score header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.gray600, fontFamily: "'DM Mono', monospace", letterSpacing: "0.08em", textTransform: "uppercase" }}>Preview · {clPreview.iterations} iteration{clPreview.iterations > 1 ? "s" : ""}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: clPreview.passes ? "#16a34a" : T.orange, fontFamily: "'DM Mono', monospace" }}>{clPreview.scorecard?.overall?.toFixed(1)}/10</span>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: clPreview.passes ? "#dcfce7" : "#fff3e0", color: clPreview.passes ? "#16a34a" : T.orange, fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{clPreview.passes ? "PASSES" : "REVIEW"}</span>
                </div>
              </div>

              {/* Scorecard bars */}
              <div style={{ marginBottom: 12 }}>
                {clPreview.scorecard?.scores && Object.entries(clPreview.scorecard.scores).map(([dim, score]) => (
                  <div key={dim} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono', monospace", width: 110, flexShrink: 0 }}>{dim.replace(/_/g, " ")}</div>
                    <div style={{ flex: 1, height: 5, background: T.gray200, borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${score * 10}%`, background: score >= 8 ? "#16a34a" : score >= 6 ? T.orange : T.red, borderRadius: 99 }} />
                    </div>
                    <div style={{ fontSize: 10, color: T.gray600, fontFamily: "'DM Mono', monospace", width: 16, textAlign: "right" }}>{score}</div>
                  </div>
                ))}
              </div>

              {/* Letter text */}
              <div style={{ fontSize: 11, color: T.gray600, fontFamily: "'Sora', sans-serif", lineHeight: 1.7, maxHeight: 200, overflowY: "auto", whiteSpace: "pre-wrap", padding: "10px 12px", background: "#fff", borderRadius: 8, border: `1px solid ${T.gray200}`, marginBottom: 10 }}>
                {clPreview.letter_text}
              </div>

              {/* Suggestions */}
              {clPreview.scorecard?.suggestions?.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  {clPreview.scorecard.suggestions.map((s, i) => (
                    <div key={i} style={{ fontSize: 10, color: T.gray400, fontFamily: "'DM Mono', monospace", marginBottom: 2 }}>• {s}</div>
                  ))}
                </div>
              )}

              {/* Re-run / Approve */}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleGenerateCoverLetter} disabled={clLoading} style={{ flex: 1, padding: "9px", borderRadius: 9, background: "#fff", border: `1px solid ${T.gray200}`, color: T.gray600, fontWeight: 700, fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: clLoading ? "wait" : "pointer" }}>
                  {clLoading ? "⏳ Regenerating..." : "↺ Re-run"}
                </button>
                <button onClick={handleApproveCoverLetter} disabled={clApproving} style={{ flex: 2, padding: "9px", borderRadius: 9, background: "#16a34a", border: "none", color: "#fff", fontWeight: 700, fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: clApproving ? "wait" : "pointer", opacity: clApproving ? 0.8 : 1 }}>
                  {clApproving ? "⏳ Saving ZIP..." : "✓ Approve & Save ZIP"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    )}
    </>
  );
};

// ─── Traces ───────────────────────────────────────────────────────────────────
const TracesView = () => {
  const [platform, setPlatform] = useState("langfuse"); // "langfuse" | "agentops"
  const [traces, setTraces] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [limit, setLimit] = useState(50);
  const [aoError, setAoError] = useState(null);
  const [lfError, setLfError] = useState(null);

  const loadLangfuse = (lim) => {
    setLoading(true); setExpanded(null); setLfError(null);
    getTraces(lim).then(d => {
      setTraces(d.traces || []);
      setMeta(d.meta || {});
      if (d.error) setLfError(d.error);
      setLoading(false);
    });
  };

  const loadAgentOps = (lim) => {
    setLoading(true); setExpanded(null); setAoError(null);
    getAgentOpsSessions(lim).then(d => {
      setSessions(d.sessions || []);
      setMeta(d.meta || {});
      if (d.error) setAoError(d.error);
      if (d.message) setAoError(d.message);
      setLoading(false);
    });
  };

  useEffect(() => {
    if (platform === "langfuse") loadLangfuse(limit);
    else loadAgentOps(limit);
  }, [platform, limit]);

  const cardStyle = { background: "rgba(255,255,255,0.72)", backdropFilter: "blur(14px)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.55)", padding: "20px 24px", marginBottom: 20 };
  const monoSm = { fontFamily: "'DM Mono', monospace", fontSize: 11 };
  const pill = (bg, col) => ({ background: bg, color: col || "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 10, fontFamily: "'DM Mono', monospace", fontWeight: 600, display: "inline-block" });

  const statusColor = (s) => {
    if (!s) return T.gray400;
    const u = s.toUpperCase();
    if (u === "SUCCESS" || u === "SUCCEEDED") return "#22c55e";
    if (u === "ERROR" || u === "FAIL" || u === "FAILED") return "#ef4444";
    return T.amber;
  };

  const fmtTime = (iso) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", dateStyle: "short", timeStyle: "medium" }); }
    catch { return iso; }
  };

  const fmtMs = (ms) => {
    if (ms == null) return "—";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const fmtDuration = (start, end) => {
    if (!start || !end) return "—";
    const ms = new Date(end) - new Date(start);
    return fmtMs(ms);
  };

  const PLATFORMS = [
    { id: "langfuse",  label: "Langfuse",  color: "#0D9488", desc: "LLM call traces · self-hosted EC2" },
    { id: "agentops",  label: "AgentOps",  color: "#7C3AED", desc: "Agent sessions · hosted SaaS" },
  ];

  const cur = PLATFORMS.find(p => p.id === platform);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, letterSpacing: "0.04em", color: T.black }}>Observability</h2>
          <p style={{ ...monoSm, color: T.gray400, marginTop: 4 }}>Compare Langfuse vs AgentOps — pick one to keep</p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ ...monoSm, color: T.gray400 }}>Show:</span>
          {[25, 50, 100].map(n => (
            <button key={n} onClick={() => setLimit(n)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: limit === n ? T.orange : T.gray100, color: limit === n ? "#fff" : T.gray400, fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>{n}</button>
          ))}
          <button onClick={() => platform === "langfuse" ? loadLangfuse(limit) : loadAgentOps(limit)} style={{ padding: "5px 12px", borderRadius: 8, border: "none", background: T.gray100, color: T.gray400, fontFamily: "'DM Mono', monospace", fontSize: 11, cursor: "pointer" }}>↺</button>
        </div>
      </div>

      {/* Platform toggle */}
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        {PLATFORMS.map(p => (
          <button key={p.id} onClick={() => { setPlatform(p.id); setExpanded(null); }} style={{ padding: "10px 20px", borderRadius: 12, border: `2px solid ${platform === p.id ? p.color : T.gray200}`, background: platform === p.id ? p.color + "18" : "rgba(255,255,255,0.6)", cursor: "pointer", textAlign: "left", minWidth: 180 }}>
            <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 13, color: platform === p.id ? p.color : T.gray400 }}>{p.label}</div>
            <div style={{ ...monoSm, color: T.gray400, marginTop: 2 }}>{p.desc}</div>
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
          <div style={{ ...monoSm, color: T.gray400 }}>Loading {cur.label}…</div>
        </div>
      )}

      {/* ── Langfuse panel ── */}
      {!loading && platform === "langfuse" && (
        <>
          {lfError && (
            <div style={{ ...cardStyle, background: "#fef2f2", border: "1px solid #fecaca" }}>
              <span style={{ ...monoSm, color: "#ef4444" }}>⚠ {lfError}</span>
            </div>
          )}
          {traces.length === 0 && !lfError && (
            <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>⟴</div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, color: T.black, marginBottom: 6 }}>No Langfuse traces yet</div>
              <div style={{ ...monoSm, color: T.gray400 }}>Run any agent — each LLM call will appear here once LANGFUSE_* keys are set on EC2.</div>
            </div>
          )}
          {traces.length > 0 && (
            <div style={cardStyle}>
              <div style={{ ...monoSm, color: T.gray400, marginBottom: 12 }}>
                {meta.totalItems != null ? `${meta.totalItems} total traces` : `${traces.length} traces`} · Munich time
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.gray200}` }}>
                    {["Name", "Model", "Speed", "Latency", "Tokens", "Cost", "Status", "Time"].map(h => (
                      <th key={h} style={{ ...monoSm, color: T.gray400, textAlign: "left", padding: "6px 10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {traces.map(t => {
                    const obs = t.observations?.[0] || {};
                    const isExp = expanded === t.id;
                    const latencyMs = t.latency != null ? t.latency : (obs.latency != null ? obs.latency : null);
                    const totalTokens = (t.usage?.input || 0) + (t.usage?.output || 0);
                    const cost = t.usage?.totalCost != null ? `$${t.usage.totalCost.toFixed(4)}` : "—";
                    const modelName = t.metadata?.model || obs.model || "—";
                    const speed = t.metadata?.speed || obs.metadata?.speed || "—";
                    return (
                      <>
                        <tr key={t.id} onClick={() => setExpanded(isExp ? null : t.id)} style={{ borderBottom: `1px solid ${T.gray100}`, cursor: "pointer", background: isExp ? "rgba(13,148,136,0.04)" : "transparent" }}>
                          <td style={{ padding: "9px 10px", fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 12, color: T.black }}>{t.name || "call_llm"}</td>
                          <td style={{ padding: "9px 10px", ...monoSm, color: T.gray400, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{modelName}</td>
                          <td style={{ padding: "9px 10px" }}>{speed !== "—" ? <span style={pill(speed === "fast" ? T.orange : T.navy)}>{speed}</span> : <span style={{ ...monoSm, color: T.gray400 }}>—</span>}</td>
                          <td style={{ padding: "9px 10px", ...monoSm, color: T.gray400 }}>{fmtMs(latencyMs)}</td>
                          <td style={{ padding: "9px 10px", ...monoSm, color: T.gray400 }}>{totalTokens > 0 ? totalTokens.toLocaleString() : "—"}</td>
                          <td style={{ padding: "9px 10px", ...monoSm, color: T.gray400 }}>{cost}</td>
                          <td style={{ padding: "9px 10px" }}><span style={{ ...monoSm, color: statusColor(t.status), fontWeight: 600 }}>{t.status || "—"}</span></td>
                          <td style={{ padding: "9px 10px", ...monoSm, color: T.gray400 }}>{fmtTime(t.timestamp)}</td>
                        </tr>
                        {isExp && (
                          <tr key={`${t.id}-exp`} style={{ background: "rgba(13,148,136,0.03)" }}>
                            <td colSpan={8} style={{ padding: "12px 16px" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                                <div>
                                  <div style={{ ...monoSm, color: T.gray400, marginBottom: 4, textTransform: "uppercase" }}>Prompt</div>
                                  <pre style={{ ...monoSm, background: T.gray100, borderRadius: 8, padding: "10px 12px", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 180, overflowY: "auto", color: T.black }}>{obs.input || t.input || "—"}</pre>
                                </div>
                                <div>
                                  <div style={{ ...monoSm, color: T.gray400, marginBottom: 4, textTransform: "uppercase" }}>Response</div>
                                  <pre style={{ ...monoSm, background: T.gray100, borderRadius: 8, padding: "10px 12px", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 180, overflowY: "auto", color: T.black }}>{obs.output || t.output || "—"}</pre>
                                </div>
                              </div>
                              {t.metadata && Object.keys(t.metadata).length > 0 && (
                                <div style={{ marginTop: 10 }}>
                                  <div style={{ ...monoSm, color: T.gray400, marginBottom: 4, textTransform: "uppercase" }}>Metadata</div>
                                  <pre style={{ ...monoSm, background: T.gray100, borderRadius: 8, padding: "8px 12px", color: T.gray400 }}>{JSON.stringify(t.metadata, null, 2)}</pre>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ── AgentOps panel ── */}
      {!loading && platform === "agentops" && (
        <>
          {aoError && (
            <div style={{ ...cardStyle, background: "#faf5ff", border: "1px solid #ddd6fe" }}>
              <span style={{ ...monoSm, color: "#7C3AED" }}>⚠ {aoError}</span>
            </div>
          )}
          {sessions.length === 0 && !aoError && (
            <div style={{ ...cardStyle, textAlign: "center", padding: 48 }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>◈</div>
              <div style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 15, color: T.black, marginBottom: 6 }}>No AgentOps sessions yet</div>
              <div style={{ ...monoSm, color: T.gray400 }}>Run any agent — each agent run creates one session. Add AGENTOPS_API_KEY to EC2 .env.</div>
            </div>
          )}
          {sessions.length > 0 && (
            <div style={cardStyle}>
              <div style={{ ...monoSm, color: T.gray400, marginBottom: 12 }}>{sessions.length} sessions · Munich time</div>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.gray200}` }}>
                    {["Session ID", "Provider", "Model", "Speed", "LLM Calls", "Tokens", "Cost", "Status", "Started"].map(h => (
                      <th key={h} style={{ ...monoSm, color: T.gray400, textAlign: "left", padding: "6px 10px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => {
                    const sid = s.session_id || "—";
                    const isExp = expanded === sid;
                    const status = s.end_state || "—";
                    const cost = s.cost != null ? `$${Number(s.cost).toFixed(4)}` : "—";
                    const tokens = s.tokens != null ? s.tokens.toLocaleString() : "—";
                    const llmCalls = s.llm_calls != null ? s.llm_calls : "—";
                    return (
                      <>
                        <tr key={sid} onClick={() => setExpanded(isExp ? null : sid)} style={{ borderBottom: `1px solid ${T.gray100}`, cursor: "pointer", background: isExp ? "rgba(124,58,237,0.04)" : "transparent" }}>
                          <td style={{ padding: "9px 10px", ...monoSm, color: T.navy }}>{String(sid).slice(0, 8)}…</td>
                          <td style={{ padding: "9px 10px" }}>{s.provider ? <span style={pill("#e0f2fe", "#0369a1")}>{s.provider}</span> : <span style={{ ...monoSm, color: T.gray400 }}>—</span>}</td>
                          <td style={{ padding: "9px 10px", ...monoSm, color: T.gray400, maxWidth: 130, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.model || "—"}</td>
                          <td style={{ padding: "9px 10px" }}>{s.speed ? <span style={pill(s.speed === "fast" ? "#fff7ed" : "#eff6ff", s.speed === "fast" ? "#c2410c" : "#1d4ed8")}>{s.speed}</span> : <span style={{ ...monoSm, color: T.gray400 }}>—</span>}</td>
                          <td style={{ padding: "9px 10px", ...monoSm, color: T.gray400 }}>{llmCalls}</td>
                          <td style={{ padding: "9px 10px", ...monoSm, color: T.gray400 }}>{tokens}</td>
                          <td style={{ padding: "9px 10px", ...monoSm, color: T.gray400 }}>{cost}</td>
                          <td style={{ padding: "9px 10px" }}><span style={{ ...monoSm, color: statusColor(status), fontWeight: 600 }}>{status}</span></td>
                          <td style={{ padding: "9px 10px", ...monoSm, color: T.gray400 }}>{fmtTime(s.created_at)}</td>
                        </tr>
                        {isExp && (
                          <tr key={`${sid}-exp`} style={{ background: "rgba(124,58,237,0.03)" }}>
                            <td colSpan={9} style={{ padding: "12px 16px" }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                                {[
                                  ["Session ID", sid],
                                  ["Provider", s.provider || "—"],
                                  ["Model", s.model || "—"],
                                  ["Speed", s.speed || "—"],
                                  ["End State", status],
                                  ["LLM Calls", llmCalls],
                                  ["Tokens", tokens],
                                  ["Cost", cost],
                                  ["Started", s.created_at ? new Date(s.created_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" }) : "—"],
                                ].map(([k, v]) => (
                                  <div key={k} style={{ background: T.gray100, borderRadius: 8, padding: "8px 12px" }}>
                                    <div style={{ ...monoSm, color: T.gray400, textTransform: "uppercase", marginBottom: 2 }}>{k}</div>
                                    <div style={{ ...monoSm, color: T.black, fontWeight: 600, wordBreak: "break-all" }}>{String(v)}</div>
                                  </div>
                                ))}
                              </div>
                              {s.detail_url && (
                                <a href={s.detail_url} target="_blank" rel="noreferrer" style={{ ...monoSm, color: "#7C3AED", textDecoration: "none" }}>
                                  ↗ View full session in AgentOps dashboard
                                </a>
                              )}
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Settings ─────────────────────────────────────────────────────────────────
function SettingsView() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "admin";

  const sectionStyle = { background: "rgba(255,255,255,0.72)", backdropFilter: "blur(14px)", borderRadius: 16, border: "1px solid rgba(255,255,255,0.55)", padding: "24px 28px", marginBottom: 20 };
  const labelStyle = { fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray400, marginBottom: 6, display: "block", textTransform: "uppercase", letterSpacing: "0.05em" };
  const inputStyle = { width: "100%", padding: "10px 14px", borderRadius: 10, border: `1px solid ${T.gray200}`, fontFamily: "'Sora', sans-serif", fontSize: 13, background: T.gray100, color: T.black, outline: "none", boxSizing: "border-box" };
  const btnPrimary = { padding: "10px 22px", borderRadius: 10, background: T.orange, border: "none", color: "#fff", fontWeight: 700, fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" };
  const btnDanger = { padding: "6px 14px", borderRadius: 8, background: T.redLight, border: `1px solid ${T.red}`, color: T.red, fontWeight: 700, fontSize: 11, fontFamily: "'DM Mono', monospace", cursor: "pointer" };
  const msgStyle = (type) => ({ fontSize: 12, fontFamily: "'DM Mono', monospace", color: type === "ok" ? T.green : T.red, marginTop: 8 });

  // ── Change password ──
  const [cpCurrent, setCpCurrent] = useState("");
  const [cpNew, setCpNew] = useState("");
  const [cpConfirm, setCpConfirm] = useState("");
  const [cpMsg, setCpMsg] = useState(null);
  const [cpLoading, setCpLoading] = useState(false);

  async function handleChangePassword(e) {
    e.preventDefault();
    if (cpNew !== cpConfirm) { setCpMsg({ type: "err", text: "New passwords don't match" }); return; }
    if (cpNew.length < 8) { setCpMsg({ type: "err", text: "Password must be at least 8 characters" }); return; }
    setCpLoading(true); setCpMsg(null);
    try {
      await changePassword(cpCurrent, cpNew);
      setCpMsg({ type: "ok", text: "Password changed successfully" });
      setCpCurrent(""); setCpNew(""); setCpConfirm("");
    } catch (e) { setCpMsg({ type: "err", text: e.message }); }
    finally { setCpLoading(false); }
  }

  // ── Pipeline settings ──
  const [ps, setPs] = useState({ cv_text: "", job_keywords: [], job_location: "Germany", llm_provider: "anthropic", llm_api_key: "", llm_model_fast: "", llm_model_smart: "", apify_token: "", apify_token_public: "", pipeline_agents: ["agent1","agent2","agent3","agent4","agent5"], schedule_times: [8, 12, 20] });
  const [psLoading, setPsLoading] = useState(true);
  const [psMsg, setPsMsg] = useState(null);
  const [psSaving, setPsSaving] = useState(false);
  const [kwInput, setKwInput] = useState("");

  useEffect(() => {
    getUserSettings().then(d => {
      if (d && Object.keys(d).length) {
        setPs(prev => ({
          ...prev,
          cv_text: d.cv_text || "",
          job_keywords: d.job_keywords || [],
          job_location: d.job_location || "Germany",
          llm_provider: d.llm_provider || "anthropic",
          llm_model_fast: d.llm_model_fast || "",
          llm_model_smart: d.llm_model_smart || "",
          apify_token: d.apify_token || "",
          apify_token_public: d.apify_token_public || "",
          pipeline_agents: d.pipeline_agents || ["agent1","agent2","agent3","agent4","agent5"],
          schedule_times: d.schedule_times || [8, 12, 20],
        }));
      }
      setPsLoading(false);
    });
  }, []);

  function addKeyword() {
    const kw = kwInput.trim();
    if (!kw || ps.job_keywords.includes(kw)) return;
    setPs(prev => ({ ...prev, job_keywords: [...prev.job_keywords, kw] }));
    setKwInput("");
  }

  async function handleSaveSettings(e) {
    e.preventDefault();
    setPsSaving(true); setPsMsg(null);
    try {
      const payload = {
        cv_text: ps.cv_text || null,
        job_keywords: ps.job_keywords.length ? ps.job_keywords : null,
        job_location: ps.job_location || null,
        llm_provider: ps.llm_provider || null,
        llm_api_key: ps.llm_api_key || null,
        llm_model_fast: ps.llm_model_fast || null,
        llm_model_smart: ps.llm_model_smart || null,
        apify_token: ps.apify_token || null,
        apify_token_public: ps.apify_token_public || null,
        pipeline_agents: ps.pipeline_agents.length ? ps.pipeline_agents : null,
        schedule_times: ps.schedule_times.length ? ps.schedule_times : null,
      };
      await updateUserSettings(payload);
      setPsMsg({ type: "ok", text: "Settings saved" });
      setPs(prev => ({ ...prev, llm_api_key: "" }));
    } catch (e) { setPsMsg({ type: "err", text: e.message }); }
    finally { setPsSaving(false); }
  }

  // ── User management ──
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [newRole, setNewRole] = useState("user");
  const [createMsg, setCreateMsg] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    if (!isAdmin) return;
    setUsersLoading(true);
    listUsers().then(d => { setUsers(d.users || []); setUsersLoading(false); }).catch(() => setUsersLoading(false));
  }, [isAdmin]);

  async function handleCreateUser(e) {
    e.preventDefault();
    if (!newEmail || !newPass) { setCreateMsg({ type: "err", text: "Email and password required" }); return; }
    setCreateLoading(true); setCreateMsg(null);
    try {
      const u = await createUser(newEmail, newPass, newRole);
      setUsers(prev => [...prev, { ...u, created_at: new Date().toISOString() }]);
      setCreateMsg({ type: "ok", text: `User ${u.email} created` });
      setNewEmail(""); setNewPass(""); setNewRole("user");
    } catch (e) { setCreateMsg({ type: "err", text: e.message }); }
    finally { setCreateLoading(false); }
  }

  async function handleDeleteUser(uid, email) {
    if (!window.confirm(`Delete user ${email}?`)) return;
    try {
      await deleteUser(uid);
      setUsers(prev => prev.filter(u => u.id !== uid));
    } catch (e) { alert(e.message); }
  }

  const PROVIDER_DEFAULTS = {
    anthropic: { fast: "claude-haiku-4-5-20251001",       smart: "claude-sonnet-4-6" },
    openai:    { fast: "gpt-4o-mini",                     smart: "gpt-4o" },
    nvidia:    { fast: "deepseek-ai/deepseek-v4-flash",   smart: "deepseek-ai/deepseek-v4-flash" },
    ollama:    { fast: "gemma2:9b",                       smart: "gemma2:9b" },
  };

  return (
    <div style={{ maxWidth: 660 }}>
      {/* Account */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif", marginBottom: 18 }}>Account</div>
        <div style={{ marginBottom: 16 }}>
          <span style={labelStyle}>Email</span>
          <div style={{ ...inputStyle, color: T.gray600 }}>{user?.email}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
          <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", background: T.orangeXLight, color: T.orange, padding: "3px 10px", borderRadius: 99, fontWeight: 700 }}>{user?.role}</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: T.gray600, fontFamily: "'Sora', sans-serif", marginBottom: 14 }}>Change Password</div>
        <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div><label style={labelStyle}>Current Password</label><input type="password" style={inputStyle} value={cpCurrent} onChange={e => setCpCurrent(e.target.value)} placeholder="Current password" /></div>
          <div><label style={labelStyle}>New Password</label><input type="password" style={inputStyle} value={cpNew} onChange={e => setCpNew(e.target.value)} placeholder="Min. 8 characters" /></div>
          <div><label style={labelStyle}>Confirm New Password</label><input type="password" style={inputStyle} value={cpConfirm} onChange={e => setCpConfirm(e.target.value)} placeholder="Repeat new password" /></div>
          {cpMsg && <div style={msgStyle(cpMsg.type)}>{cpMsg.text}</div>}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 4 }}>
            <button type="submit" style={btnPrimary} disabled={cpLoading}>{cpLoading ? "Saving…" : "Update Password"}</button>
            <button type="button" onClick={logout} style={{ padding: "10px 22px", borderRadius: 10, background: T.redLight, border: `1px solid ${T.red}`, color: T.red, fontWeight: 700, fontSize: 12, fontFamily: "'DM Mono', monospace", cursor: "pointer" }}>Sign Out</button>
          </div>
        </form>
      </div>

      {/* Pipeline Settings */}
      <div style={sectionStyle}>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif", marginBottom: 4 }}>Pipeline Settings</div>
        <div style={{ fontSize: 12, color: T.gray400, fontFamily: "'DM Mono', monospace", marginBottom: 18 }}>Your CV, LLM provider, API keys, and job search preferences</div>
        {psLoading ? (
          <div style={{ fontSize: 12, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>Loading…</div>
        ) : (
          <form onSubmit={handleSaveSettings} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {/* CV */}
            <div>
              <label style={labelStyle}>CV / Resume</label>
              <textarea
                style={{ ...inputStyle, minHeight: 140, resize: "vertical", lineHeight: 1.5 }}
                value={ps.cv_text}
                onChange={e => setPs(prev => ({ ...prev, cv_text: e.target.value }))}
                placeholder="Paste your CV text here. Agents will use this for scoring and tailoring."
              />
            </div>

            {/* Job search */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Job Location</label>
                <input style={inputStyle} value={ps.job_location} onChange={e => setPs(prev => ({ ...prev, job_location: e.target.value }))} placeholder="e.g. Germany" />
              </div>
              <div>
                <label style={labelStyle}>LLM Provider</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={ps.llm_provider} onChange={e => setPs(prev => ({ ...prev, llm_provider: e.target.value }))}>
                  <option value="anthropic">Anthropic (Claude)</option>
                  <option value="openai">OpenAI (GPT)</option>
                  <option value="nvidia">NVIDIA NIM (DeepSeek-V4-Flash)</option>
                  <option value="ollama">Ollama (local)</option>
                </select>
              </div>
            </div>

            {/* Keywords */}
            <div>
              <label style={labelStyle}>Job Keywords</label>
              <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={kwInput}
                  onChange={e => setKwInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addKeyword(); } }}
                  placeholder="Add keyword and press Enter"
                />
                <button type="button" onClick={addKeyword} style={{ ...btnPrimary, padding: "10px 16px", whiteSpace: "nowrap" }}>Add</button>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ps.job_keywords.map(kw => (
                  <span key={kw} style={{ background: T.orangeXLight, color: T.orange, fontSize: 11, fontFamily: "'DM Mono', monospace", padding: "3px 10px", borderRadius: 99, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                    {kw}
                    <span style={{ cursor: "pointer", fontSize: 13, lineHeight: 1 }} onClick={() => setPs(prev => ({ ...prev, job_keywords: prev.job_keywords.filter(k => k !== kw) }))}>×</span>
                  </span>
                ))}
                {ps.job_keywords.length === 0 && <span style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>No keywords — will use defaults</span>}
              </div>
            </div>

            {/* LLM API Key */}
            <div>
              <label style={labelStyle}>LLM API Key <span style={{ color: T.gray400 }}>(leave blank to keep existing)</span></label>
              <input type="password" style={inputStyle} value={ps.llm_api_key} onChange={e => setPs(prev => ({ ...prev, llm_api_key: e.target.value }))} placeholder={ps.llm_provider === "ollama" ? "Not needed for Ollama" : ps.llm_provider === "nvidia" ? "nvapi-…" : "sk-…"} />
            </div>

            {/* Model overrides */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Fast Model <span style={{ color: T.gray400 }}>(Agent 2)</span></label>
                <input style={inputStyle} value={ps.llm_model_fast} onChange={e => setPs(prev => ({ ...prev, llm_model_fast: e.target.value }))} placeholder={PROVIDER_DEFAULTS[ps.llm_provider]?.fast || "default"} />
              </div>
              <div>
                <label style={labelStyle}>Smart Model <span style={{ color: T.gray400 }}>(Agents 3-5)</span></label>
                <input style={inputStyle} value={ps.llm_model_smart} onChange={e => setPs(prev => ({ ...prev, llm_model_smart: e.target.value }))} placeholder={PROVIDER_DEFAULTS[ps.llm_provider]?.smart || "default"} />
              </div>
            </div>

            {/* Apify tokens */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div>
                <label style={labelStyle}>Apify Token <span style={{ color: T.gray400 }}>(Indeed)</span></label>
                <input type="password" style={inputStyle} value={ps.apify_token} onChange={e => setPs(prev => ({ ...prev, apify_token: e.target.value }))} placeholder="apify_api_…" />
              </div>
              <div>
                <label style={labelStyle}>Apify Token Public <span style={{ color: T.gray400 }}>(LinkedIn)</span></label>
                <input type="password" style={inputStyle} value={ps.apify_token_public} onChange={e => setPs(prev => ({ ...prev, apify_token_public: e.target.value }))} placeholder="apify_api_…" />
              </div>
            </div>

            {/* Pipeline agent toggles */}
            <div>
              <label style={labelStyle}>Pipeline Agents</label>
              <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>Choose which agents run automatically in your daily pipeline</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { id: "agent1", label: "Agent 1 — Job Scraper",     desc: "Scrapes Arbeitsagentur, LinkedIn, Indeed" },
                  { id: "agent2", label: "Agent 2 — CV Matcher",      desc: "Scores jobs against your CV (required for gaps)" },
                  { id: "agent3", label: "Agent 3 — Gap Analyst",     desc: "Identifies skill gaps across matched jobs" },
                  { id: "agent4", label: "Agent 4 — Interview Coach", desc: "Generates prep questions when you reach Interview stage" },
                  { id: "agent5", label: "Agent 5 — Reporter",        desc: "Weekly digest email (runs Sundays)" },
                ].map(a => {
                  const on = ps.pipeline_agents.includes(a.id);
                  return (
                    <div key={a.id} onClick={() => setPs(prev => ({ ...prev, pipeline_agents: on ? prev.pipeline_agents.filter(x => x !== a.id) : [...prev.pipeline_agents, a.id] }))}
                      style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 10, border: `1px solid ${on ? T.orange : T.gray200}`, background: on ? T.orangeXLight : T.gray100, cursor: "pointer", userSelect: "none" }}>
                      <div style={{ width: 36, height: 20, borderRadius: 99, background: on ? T.orange : T.gray300, position: "relative", flexShrink: 0, transition: "background 0.15s" }}>
                        <div style={{ position: "absolute", top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: T.black, fontFamily: "'DM Mono', monospace" }}>{a.label}</div>
                        <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'Sora', sans-serif", marginTop: 1 }}>{a.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Schedule times */}
            <div>
              <label style={labelStyle}>Pipeline Schedule <span style={{ color: T.gray400 }}>(Munich time)</span></label>
              <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace", marginBottom: 10 }}>Select which Munich time hours Agent 1 pipeline triggers (Mon–Fri). Click to toggle.</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {Array.from({ length: 24 }, (_, h) => {
                  const on = ps.schedule_times.includes(h);
                  const label = `${String(h).padStart(2, "0")}:00`;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setPs(prev => ({
                        ...prev,
                        schedule_times: on
                          ? prev.schedule_times.filter(t => t !== h)
                          : [...prev.schedule_times, h].sort((a, b) => a - b),
                      }))}
                      style={{
                        padding: "5px 10px", borderRadius: 8, fontSize: 11,
                        fontFamily: "'DM Mono', monospace", fontWeight: on ? 700 : 400, cursor: "pointer",
                        border: `1px solid ${on ? T.orange : T.gray200}`,
                        background: on ? T.orange : T.gray100,
                        color: on ? "#fff" : T.gray600,
                        transition: "all 0.12s",
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              {ps.schedule_times.length === 0 && (
                <div style={{ fontSize: 11, color: T.red, fontFamily: "'DM Mono', monospace", marginTop: 6 }}>No hours selected — pipeline won't trigger automatically</div>
              )}
              <div style={{ fontSize: 11, color: T.gray400, fontFamily: "'DM Mono', monospace", marginTop: 6 }}>
                Selected: {ps.schedule_times.length === 0 ? "none" : ps.schedule_times.map(h => `${String(h).padStart(2,"0")}:00`).join(", ")} Munich time
              </div>
            </div>

            {psMsg && <div style={msgStyle(psMsg.type)}>{psMsg.text}</div>}
            <div>
              <button type="submit" style={btnPrimary} disabled={psSaving}>{psSaving ? "Saving…" : "Save Settings"}</button>
            </div>
          </form>
        )}
      </div>

      {/* User Management — admin only */}
      {isAdmin && (
        <div style={sectionStyle}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.black, fontFamily: "'Sora', sans-serif", marginBottom: 18 }}>User Management</div>
          <div style={{ marginBottom: 24 }}>
            {usersLoading ? (
              <div style={{ fontSize: 12, color: T.gray400, fontFamily: "'DM Mono', monospace" }}>Loading…</div>
            ) : users.length === 0 ? (
              <EmptyState message="No users found" />
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: "'DM Mono', monospace" }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${T.gray200}` }}>
                    {["Email", "Role", "Created", ""].map(h => (
                      <th key={h} style={{ textAlign: "left", padding: "6px 10px", color: T.gray400, fontWeight: 500, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} style={{ borderBottom: `1px solid ${T.gray100}` }}>
                      <td style={{ padding: "9px 10px", color: T.black }}>{u.email}</td>
                      <td style={{ padding: "9px 10px" }}>
                        <span style={{ background: u.role === "admin" ? T.orangeXLight : T.gray100, color: u.role === "admin" ? T.orange : T.gray600, padding: "2px 8px", borderRadius: 99, fontWeight: 700, fontSize: 10 }}>{u.role}</span>
                      </td>
                      <td style={{ padding: "9px 10px", color: T.gray400 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : "—"}</td>
                      <td style={{ padding: "9px 10px" }}>
                        {u.id !== user?.id && (
                          <button style={btnDanger} onClick={() => handleDeleteUser(u.id, u.email)}>Delete</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.gray600, fontFamily: "'Sora', sans-serif", marginBottom: 14 }}>Create New User</div>
          <form onSubmit={handleCreateUser} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div><label style={labelStyle}>Email</label><input type="email" style={inputStyle} value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" /></div>
            <div><label style={labelStyle}>Password</label><input type="password" style={inputStyle} value={newPass} onChange={e => setNewPass(e.target.value)} placeholder="Min. 8 characters" /></div>
            <div>
              <label style={labelStyle}>Role</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={newRole} onChange={e => setNewRole(e.target.value)}>
                <option value="user">user</option>
                <option value="admin">admin</option>
              </select>
            </div>
            {createMsg && <div style={msgStyle(createMsg.type)}>{createMsg.text}</div>}
            <div><button type="submit" style={btnPrimary} disabled={createLoading}>{createLoading ? "Creating…" : "Create User"}</button></div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [active, setActive] = useState(() => localStorage.getItem("activeTab") || "overview");
  const [collapsed, setCollapsed] = useState(false);
  const [llmMode, setLlmModeState] = useState("online");

  useEffect(() => {
    fetchLLMMode().then(d => { if (d?.mode) setLlmModeState(d.mode); });
  }, []);

  useEffect(() => { localStorage.setItem("activeTab", active); }, [active]);
  const pageTitle = navItems.find(n => n.id === active)?.label || "";

  // ── Live data state — empty until API responds ──
  const [jobs, setJobs] = useState([]);
  const [liveStats, setLiveStats] = useState({ today: 0, total: 0, applied: 0, interviews: 0 });
  const [liveTrend, setLiveTrend] = useState([]);
  const [livePipeline, setLivePipeline] = useState([]);
  const [apiStatus, setApiStatus] = useState("loading"); // "loading" | "ok" | "error"

  useEffect(() => {
    Promise.all([fetchJobs(), fetchStats()]).then(([jobData, statsData]) => {
      if (jobData === null && statsData === null) {
        setApiStatus("error");
      } else {
        setApiStatus("ok");
        if (jobData?.length) setJobs(jobData);
        if (statsData) {
          setLiveStats({ today: statsData.today, total: statsData.total, applied: statsData.applied, interviews: statsData.interviews, last_run: statsData.last_run });
          if (statsData.trend?.length) setLiveTrend(statsData.trend);
          if (statsData.pipeline?.length) setLivePipeline(statsData.pipeline);
        }
      }
    });
  }, []);

  const API = import.meta.env.VITE_API_URL || "http://16.170.177.86:8000";
  const ctxValue = { jobs, trendData: liveTrend, pipeline: livePipeline, stats: liveStats, apiStatus, API };

  const renderPage = () => {
    if (active === "overview") return <Overview />;
    if (active === "jobs") return <JobsBoard />;
    if (active === "tracker") return <ManualTracker />;
    if (active === "map") return <MapView />;
    if (active === "gaps") return <SkillGaps />;
    if (active === "timeline") return <YourProjects />;
    if (active === "interview") return <InterviewPrepView />;
    if (active === "analytics") return <Analytics />;
    if (active === "automation") return <><AgentRunner /><AutomationLogs /></>;
    if (active === "scraper") return <ScraperStats />;
    if (active === "traces") return <TracesView />;
    if (active === "profile") return <ProfileView />;
    if (active === "settings") return <SettingsView />;
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

      <div style={{ display: "flex", height: "100vh", background: "#EDEAE4", fontFamily: "'Sora', sans-serif", position: "relative", overflow: "hidden" }}>
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
              {/* LLM Mode Toggle */}
              <div style={{
                display: "flex", alignItems: "center",
                background: "#fff", border: `1px solid ${T.gray200}`,
                borderRadius: 99, padding: "3px 4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}>
                {[
                  { id: "local", label: "Local",  color: T.green,  title: "gemma2:9b via Ollama" },
                  { id: "cc",    label: "CC",      color: T.navy,   title: "Claude Code CLI (Sonnet 4.6, OAuth)" },
                  { id: "online",label: "Online",  color: T.orange, title: "Claude API + gemma2 fallback" },
                ].map(({ id, label, color, title }) => (
                  <button
                    key={id}
                    title={title}
                    onClick={() => { setLlmModeState(id); setLLMMode(id); }}
                    style={{
                      fontSize: 10, fontFamily: "'DM Mono', monospace", fontWeight: 700,
                      padding: "3px 9px", borderRadius: 99, border: "none", cursor: "pointer",
                      transition: "all 0.2s",
                      background: llmMode === id ? color : "transparent",
                      color: llmMode === id ? "#fff" : T.gray400,
                    }}
                  >{label}</button>
                ))}
              </div>
              <div style={{ width: 36, height: 36, borderRadius: 12, background: "#fff", border: `1px solid ${T.gray200}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>🔔</div>
            </div>
          </div>

          {/* Content */}
          <div style={{ padding: "24px 32px", animation: "fadeUp 0.25s ease" }} key={active}>
            <ConnectionBanner />
            {renderPage()}
          </div>
        </div>
      </div>
    </>
    </DataCtx.Provider>
  );
}

function AppWithAuth() {
  const { token, loading, logout } = useAuth();
  if (loading) return (
    <div style={{ minHeight: "100vh", background: "#EDEAE4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Sora', sans-serif", color: "#9A9A9A", fontSize: 13 }}>
      Loading…
    </div>
  );
  if (!token) return <LoginPage />;
  return <App onLogout={logout} />;
}

export default function Root() {
  return <AuthProvider><AppWithAuth /></AuthProvider>;
}
