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
