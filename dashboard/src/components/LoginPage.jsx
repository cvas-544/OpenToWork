import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const T = {
  orange: "#E8621A", orangeXLight: "#FEF0E8",
  black: "#0D0D0D", gray600: "#5A5A5A", gray200: "#E8E8E8",
  gray100: "#F4F4F2", white: "#FFFFFF", red: "#DC2626",
};

export function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw]     = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#EDEAE4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Sora', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Sora:wght@400;600;700&family=DM+Mono:wght@400;500&display=swap');* { box-sizing: border-box; margin: 0; padding: 0; }`}</style>

      {/* Ambient blobs */}
      <div style={{ position: "fixed", top: "10%", right: "20%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,98,26,0.08) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "fixed", bottom: "10%", left: "20%", width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(232,98,26,0.05) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ width: 400, background: "rgba(255,255,255,0.7)", backdropFilter: "blur(20px)", borderRadius: 20, padding: "40px 36px", border: `1px solid ${T.gray200}`, boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>
        {/* Logo */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: T.orange, letterSpacing: "0.05em" }}>OpenToWork</div>
          <div style={{ fontSize: 12, color: T.gray600, fontFamily: "'DM Mono', monospace", marginTop: 4 }}>Sign in to your dashboard</div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Email */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              placeholder="you@example.com"
              style={{ padding: "10px 14px", borderRadius: 10, border: `1px solid ${T.gray200}`, background: T.white, fontSize: 13, fontFamily: "'Sora', sans-serif", outline: "none", color: T.black }}
            />
          </div>

          {/* Password */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color: T.gray600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Password</label>
            <div style={{ position: "relative" }}>
              <input
                type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required
                placeholder="••••••••"
                style={{ width: "100%", padding: "10px 40px 10px 14px", borderRadius: 10, border: `1px solid ${T.gray200}`, background: T.white, fontSize: 13, fontFamily: "'Sora', sans-serif", outline: "none", color: T.black }}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.gray600, fontSize: 13 }}>
                {showPw ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: T.red, fontFamily: "'DM Mono', monospace" }}>
              {error}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            style={{ marginTop: 8, padding: "12px", borderRadius: 10, background: loading ? T.gray200 : T.orange, color: T.white, border: "none", fontSize: 13, fontWeight: 700, fontFamily: "'Sora', sans-serif", cursor: loading ? "not-allowed" : "pointer", transition: "background 0.15s" }}>
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
