const API_URL = import.meta.env.VITE_API_URL || "http://16.170.177.86:8000";

export async function fetchJobs() {
  try {
    const res = await fetch(`${API_URL}/data/jobs`);
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.jobs;
  } catch (e) {
    console.warn("[API] fetchJobs failed, using mock data:", e.message);
    return null;
  }
}

export async function fetchStats() {
  try {
    const res = await fetch(`${API_URL}/data/stats`);
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (e) {
    console.warn("[API] fetchStats failed, using mock data:", e.message);
    return null;
  }
}

export async function fetchProfile() {
  try {
    const res = await fetch(`${API_URL}/profile`);
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (e) {
    console.warn("[API] fetchProfile failed:", e.message);
    return null;
  }
}

export async function fetchRadar() {
  try {
    const res = await fetch(`${API_URL}/data/radar`);
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.radar;
  } catch (e) {
    console.warn("[API] fetchRadar failed, using mock data:", e.message);
    return null;
  }
}

export async function fetchDailySkills() {
  try {
    const res = await fetch(`${API_URL}/data/skills-daily`);
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.skills;
  } catch (e) {
    console.warn("[API] fetchDailySkills failed:", e.message);
    return null;
  }
}

export async function fetchGaps() {
  try {
    const res = await fetch(`${API_URL}/data/gaps`);
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.gaps;
  } catch (e) {
    console.warn("[API] fetchGaps failed, using mock data:", e.message);
    return null;
  }
}

export async function updateSkills(skills) {
  try {
    const res = await fetch(`${API_URL}/profile/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills }),
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (e) {
    console.warn("[API] updateSkills failed:", e.message);
    return null;
  }
}
