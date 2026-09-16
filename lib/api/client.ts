import { trackRequest } from "@/lib/loading/store";

/**
 * Thin fetch wrapper. Every UI call goes through here, so swapping the mock
 * route handlers for a real backend only touches this layer.
 */
export class ApiError extends Error {
  status: number;
  /** Parsed JSON body of the failed response, when available. */
  payload?: unknown;
  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

export function request<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  return trackRequest(doRequest<T>(url, init));
}

async function doRequest<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    ...rest,
    headers: { "Content-Type": "application/json", ...(rest.headers ?? {}) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    cache: "no-store",
  });
  if (!res.ok) {
    let message = res.statusText || "Request failed";
    let payload: unknown;
    try {
      const data = (await res.json()) as { error?: string | { message?: string } };
      payload = data;
      if (typeof data.error === "string") message = data.error;
      else if (data.error?.message) message = data.error.message;
    } catch {
      /* ignore */
    }
    throw new ApiError(message, res.status, payload);
  }
  return (await res.json()) as T;
}

export function qs(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : "";
}
