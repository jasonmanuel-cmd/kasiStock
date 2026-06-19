export class ApiError extends Error {
  constructor(status, body) {
    super(body?.detail || `API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

let accessToken = "";
const apiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") || "";

export function setAccessToken(token) {
  accessToken = token;
}

export async function api(path, options = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method: options.method || "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(response.status, body);
  }
  if (response.status === 204) return null;
  return response.json();
}
