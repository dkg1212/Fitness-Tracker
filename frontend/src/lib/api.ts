const API_ROOT = import.meta.env.VITE_API_URL ?? "/api";
let getToken: (() => Promise<string | null>) | null = null;
export const setApiTokenGetter = (getter: (() => Promise<string | null>) | null) => { getToken = getter; };
export class ApiError extends Error { constructor(public status: number, message: string) { super(message); } }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await getToken?.();
  const response = await fetch(`${API_ROOT}${path}`, { headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init?.headers ?? {}) }, ...init });
  if (!response.ok) { const body = await response.json().catch(() => null); throw new ApiError(response.status, body?.detail ?? response.statusText); }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export const apiGet = <T>(path: string) => request<T>(path);
export const apiPost = <T>(path: string, body?: unknown) => request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
export const apiPut = <T>(path: string, body: unknown) => request<T>(path, { method: "PUT", body: JSON.stringify(body) });
export const apiDelete = <T>(path: string) => request<T>(path, { method: "DELETE" });
