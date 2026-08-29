import { WPPaginationMeta } from "../types/wordpress";

const BASE_URL = (import.meta.env.VITE_WORDPRESS_API as string | undefined) ?? "";
const CACHE_TTL = 5 * 60 * 1000;

interface CacheEntry<T> {
  expires: number;
  value: T;
}

const responseCache = new Map<string, CacheEntry<unknown>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export interface PagedResponse<T> {
  data: T[];
  pagination: WPPaginationMeta;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean>): string {
  if (!BASE_URL) {
    throw new ApiError(0, "WordPress API URL not configured. Set VITE_WORDPRESS_API in your .env file.");
  }

  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }

  return url.toString();
}

async function fetchJson<T>(url: string, paged: boolean): Promise<T> {
  const cached = responseCache.get(url);
  if (cached && cached.expires > Date.now()) return cached.value as T;
  responseCache.delete(url);

  const existingRequest = inFlightRequests.get(url);
  if (existingRequest) return existingRequest as Promise<T>;

  const request = fetch(url, {
    headers: { Accept: "application/json" },
  }).then(async res => {
    if (!res.ok) {
      throw new ApiError(res.status, `WordPress API error: ${res.status} ${res.statusText}`);
    }

    const data = paged
      ? {
          data: await res.json() as T[],
          pagination: {
            total: parseInt(res.headers.get("X-WP-Total") ?? "0", 10),
            totalPages: parseInt(res.headers.get("X-WP-TotalPages") ?? "1", 10),
          },
        }
      : await res.json() as T;
    responseCache.set(url, { expires: Date.now() + CACHE_TTL, value: data });
    return data as T;
  }).finally(() => {
    inFlightRequests.delete(url);
  });

  inFlightRequests.set(url, request);
  return request;
}

async function request<T>(path: string, params?: Record<string, string | number | boolean>): Promise<T> {
  return fetchJson<T>(buildUrl(path, params), false);
}

async function requestPaged<T>(path: string, params?: Record<string, string | number | boolean>): Promise<PagedResponse<T>> {
  return fetchJson<PagedResponse<T>>(buildUrl(path, params), true);
}

export const apiClient = { request, requestPaged };
