import type { VercelRequest, VercelResponse } from "@vercel/node";

export const DEFAULT_JSON_BODY_LIMIT = 64 * 1024;
const requestCounts = new Map<string, { count: number; resetAt: number }>();

export class RequestValidationError extends Error {
  constructor(public statusCode: 400 | 413, message: string) {
    super(message);
    this.name = "RequestValidationError";
  }
}

export function requireRateLimit(req: VercelRequest, res: VercelResponse, key: string, limit: number, windowMs: number): boolean {
  const forwardedFor = req.headers["x-forwarded-for"];
  const source = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  const ip = String(source ?? req.socket?.remoteAddress ?? "unknown").split(",")[0].trim();
  const bucketKey = `${key}:${ip}`;
  const now = Date.now();
  const current = requestCounts.get(bucketKey);
  const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
  bucket.count += 1;
  requestCounts.set(bucketKey, bucket);

  if (bucket.count <= limit) return true;
  res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
  res.status(429).json({ error: "Too many requests. Please try again later." });
  return false;
}

export function assertMaxString(value: unknown, field: string, maxLength: number, required = false): string | null {
  if (value === undefined || value === null || value === "") {
    if (required) throw new RequestValidationError(400, `${field} is required.`);
    return null;
  }
  if (typeof value !== "string") throw new RequestValidationError(400, `${field} is invalid.`);
  if (value.length > maxLength) throw new RequestValidationError(413, `${field} is too long.`);
  return value;
}

export function safeErrorResponse(error: unknown, fallback: string) {
  if (error instanceof RequestValidationError) return { status: error.statusCode, body: { error: error.message } };
  return { status: 500, body: { error: fallback } };
}
