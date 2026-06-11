const API_URL = import.meta.env.VITE_API_URL || "http://16.170.177.86:8000";

const authHeaders = () => {
  const token = localStorage.getItem("otw_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export async function fetchJobs() {
  try {
    const res = await fetch(`${API_URL}/data/jobs?limit=2000`, { headers: authHeaders() });
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
    const res = await fetch(`${API_URL}/data/stats`, { headers: authHeaders() });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (e) {
    console.warn("[API] fetchStats failed, using mock data:", e.message);
    return null;
  }
}

export async function fetchProfile() {
  try {
    const res = await fetch(`${API_URL}/profile`, { headers: authHeaders() });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (e) {
    console.warn("[API] fetchProfile failed:", e.message);
    return null;
  }
}

export async function fetchRadar() {
  try {
    const res = await fetch(`${API_URL}/data/radar`, { headers: authHeaders() });
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
    const res = await fetch(`${API_URL}/data/skills-daily`, { headers: authHeaders() });
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
    const res = await fetch(`${API_URL}/data/gaps`, { headers: authHeaders() });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.gaps;
  } catch (e) {
    console.warn("[API] fetchGaps failed, using mock data:", e.message);
    return null;
  }
}

export async function previewTailorCV(jobId) {
  const res = await fetch(`${API_URL}/cv/tailor/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ job_id: jobId }),
  });
  if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
  return await res.json();
}

export async function tailorCV(jobId, includeCoverLetter = true, skillsToAdd = [], skillsToRemove = [], coverLetterText = null) {
  const res = await fetch(`${API_URL}/cv/tailor`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      job_id: jobId,
      include_cover_letter: includeCoverLetter,
      skills_to_add: skillsToAdd,
      skills_to_remove: skillsToRemove,
      cover_letter_text: coverLetterText,
    }),
  });
  if (!res.ok) throw new Error(`Tailor CV failed: ${res.status}`);
  return await res.json();
}

export async function previewTailorCVManual(title, company, description) {
  const res = await fetch(`${API_URL}/cv/tailor/preview-manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title, company, description }),
  });
  if (!res.ok) throw new Error(`Preview failed: ${res.status}`);
  return await res.json();
}

export async function tailorCVManual(title, company, description, includeCoverLetter = true, skillsToAdd = [], skillsToRemove = [], coverLetterText = null) {
  const res = await fetch(`${API_URL}/cv/tailor-manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({
      title, company, description,
      include_cover_letter: includeCoverLetter,
      skills_to_add: skillsToAdd,
      skills_to_remove: skillsToRemove,
      cover_letter_text: coverLetterText,
    }),
  });
  if (!res.ok) throw new Error(`Tailor CV (manual) failed: ${res.status}`);
  return await res.json();
}

export async function previewCoverLetterManual(title, company, description) {
  const res = await fetch(`${API_URL}/cv/cover-letter/preview-manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title, company, description }),
  });
  if (!res.ok) throw new Error(`Cover letter preview (manual) failed: ${res.status}`);
  return await res.json();
}

export async function approveCoverLetterManual(title, company, letterText) {
  const res = await fetch(`${API_URL}/cv/cover-letter/approve-manual`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ title, company, letter_text: letterText }),
  });
  if (!res.ok) throw new Error(`Cover letter approve (manual) failed: ${res.status}`);
  return await res.json();
}

export async function previewCoverLetter(jobId) {
  const res = await fetch(`${API_URL}/cv/cover-letter/preview`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ job_id: jobId }),
  });
  if (!res.ok) throw new Error(`Cover letter preview failed: ${res.status}`);
  return await res.json();
}

export async function approveCoverLetter(jobId, letterText) {
  const res = await fetch(`${API_URL}/cv/cover-letter/approve`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ job_id: jobId, letter_text: letterText }),
  });
  if (!res.ok) throw new Error(`Cover letter approve failed: ${res.status}`);
  return await res.json();
}

export async function fetchInterviewPrep() {
  try {
    const res = await fetch(`${API_URL}/data/interview-prep`, { headers: authHeaders() });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.prep;
  } catch (e) {
    console.warn("[API] fetchInterviewPrep failed:", e.message);
    return null;
  }
}

export async function updateApplicationStatus(jobId, status, notes = "") {
  try {
    const res = await fetch(`${API_URL}/applications/${jobId}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ status, notes }),
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (e) {
    console.warn("[API] updateApplicationStatus failed:", e.message);
    return null;
  }
}

export async function fetchScraperStats() {
  try {
    const res = await fetch(`${API_URL}/data/scraper-stats`, { headers: authHeaders() });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (e) {
    console.warn("[API] fetchScraperStats failed:", e.message);
    return null;
  }
}

export async function fetchManualApplications() {
  try {
    const res = await fetch(`${API_URL}/manual-applications`, { headers: authHeaders() });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.applications;
  } catch (e) {
    console.warn("[API] fetchManualApplications failed:", e.message);
    return null;
  }
}

export async function createManualApplication(payload) {
  const res = await fetch(`${API_URL}/manual-applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Create failed: ${res.status}`);
  return await res.json();
}

export async function updateManualApplicationStatus(appId, status, notes = "") {
  const res = await fetch(`${API_URL}/manual-applications/${appId}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ status, notes }),
  });
  if (!res.ok) throw new Error(`Status update failed: ${res.status}`);
  return await res.json();
}

export async function deleteManualApplication(appId) {
  const res = await fetch(`${API_URL}/manual-applications/${appId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
  return await res.json();
}

export async function updateSkills(skills) {
  try {
    const res = await fetch(`${API_URL}/profile/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ skills }),
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (e) {
    console.warn("[API] updateSkills failed:", e.message);
    return null;
  }
}

export async function fetchLLMMode() {
  try {
    const res = await fetch(`${API_URL}/settings/llm-mode`, { headers: authHeaders() });
    if (!res.ok) throw new Error("API error");
    return await res.json(); // { mode: "online" | "local" }
  } catch (e) {
    console.warn("[API] fetchLLMMode failed:", e.message);
    return { mode: "online" };
  }
}

export async function listUsers() {
  const res = await fetch(`${API_URL}/auth/users`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`List users failed: ${res.status}`);
  return await res.json();
}

export async function createUser(email, password, role = "user") {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ email, password, role }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Create user failed: ${res.status}`);
  }
  return await res.json();
}

export async function deleteUser(userId) {
  const res = await fetch(`${API_URL}/auth/users/${userId}`, {
    method: "DELETE",
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Delete user failed: ${res.status}`);
  return await res.json();
}

export async function changePassword(currentPassword, newPassword) {
  const res = await fetch(`${API_URL}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Change password failed: ${res.status}`);
  }
  return await res.json();
}

export async function setLLMMode(mode) {
  try {
    const res = await fetch(`${API_URL}/settings/llm-mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (e) {
    console.warn("[API] setLLMMode failed:", e.message);
    return null;
  }
}

export async function getUserSettings() {
  try {
    const res = await fetch(`${API_URL}/settings/user`, { headers: authHeaders() });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (e) {
    console.warn("[API] getUserSettings failed:", e.message);
    return {};
  }
}

export async function updateUserSettings(payload) {
  const res = await fetch(`${API_URL}/settings/user`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Settings update failed: ${res.status}`);
  }
  return await res.json();
}

export async function getAgentOpsSessions(limit = 50) {
  try {
    const res = await fetch(`${API_URL}/data/agentops?limit=${limit}`, { headers: authHeaders() });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (e) {
    console.warn("[API] getAgentOpsSessions failed:", e.message);
    return { sessions: [], meta: {} };
  }
}

export async function fetchAnalysis() {
  try {
    const res = await fetch(`${API_URL}/data/analysis`, { headers: authHeaders() });
    if (!res.ok) throw new Error("API error");
    const data = await res.json();
    return data.report;
  } catch (e) {
    console.warn("[API] fetchAnalysis failed:", e.message);
    return null;
  }
}

export async function runAgent9(scoreThreshold = 50, maxJobs = 50) {
  const res = await fetch(`${API_URL}/run/agent9`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ score_threshold: scoreThreshold, max_jobs: maxJobs }),
  });
  if (!res.ok) throw new Error(`Agent 9 failed: ${res.status}`);
  return await res.json();
}

export async function getTraces(limit = 50) {
  try {
    const res = await fetch(`${API_URL}/data/traces?limit=${limit}`, { headers: authHeaders() });
    if (!res.ok) throw new Error("API error");
    return await res.json();
  } catch (e) {
    console.warn("[API] getTraces failed:", e.message);
    return { traces: [], meta: {} };
  }
}
