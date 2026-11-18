export const API_URL = (import.meta.env.VITE_API_URL || "https://warehouse-eta-gules.vercel.app").replace(/\/+$/, "");

export async function apiRequest(path, { token, method = "GET", body, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}/api${path.startsWith("/") ? path : `/${path}`}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new Error(`Can't reach the API at ${API_URL}. Check the backend deployment and CORS settings.`);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && token) {
      localStorage.removeItem("warehouse-session");
      window.dispatchEvent(new Event("warehouse:unauthorized"));
    }
    throw new Error(payload.message || `Request failed (${response.status})`);
  }
  return payload;
}
