const configuredApiOrigin = import.meta.env.DEV ? (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "") : "";
export const API_URL = configuredApiOrigin || window.location.origin;

export function queryString(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && value !== "") params.set(key, String(value));
  }
  const result = params.toString();
  return result ? `?${result}` : "";
}

export async function apiRequest(path, { method = "GET", body, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(`${configuredApiOrigin}/api${path.startsWith("/") ? path : `/${path}`}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...headers,
      },
      credentials: "include",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(`Can't reach the API at ${API_URL}. Check the backend deployment and CORS settings.`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && !path.startsWith("/auth/login") && !path.startsWith("/auth/register")) {
      try { localStorage.removeItem("warehouse-session"); } catch { /* Session state is cleared by the event either way. */ }
      window.dispatchEvent(new Event("warehouse:unauthorized"));
    }
    throw new Error(payload.message || `Request failed (${response.status})`);
  }
  return payload;
}
