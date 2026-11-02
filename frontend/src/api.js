// Empty VITE_API_URL means "same origin" (used behind the nginx proxy in Docker).
const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

function describe(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => `${(d.loc || []).slice(1).join(".")}: ${d.msg}`).join("; ");
  }
  return "";
}

async function request(path, options) {
  let res;
  try {
    res = await fetch(`${BASE}/api/v1${path}`, options);
  } catch {
    throw new Error(`Cannot reach the backend at ${BASE || "this site"}. Is it running?`);
  }
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(describe(body?.detail) || `Request failed (${res.status})`);
  return body;
}

export function uploadSystem(file) {
  const form = new FormData();
  form.append("file", file);
  return request("/upload", { method: "POST", body: form });
}

export const getSchema = (id, type) => request(`/systems/${id}/schema?controller_type=${type}`);

export const simulate = (id, body) =>
  request(`/systems/${id}/simulate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const autotune = (id, body) =>
  request(`/systems/${id}/autotune`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
