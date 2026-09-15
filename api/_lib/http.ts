import type { VercelRequest, VercelResponse } from "@vercel/node";
import { DEFAULT_JSON_BODY_LIMIT, RequestValidationError } from "./security.js";

export function method(req: VercelRequest, res: VercelResponse, expected: string) {
  if (req.method !== expected) {
    res.setHeader("Allow", expected);
    res.status(405).json({ error: "Method not allowed" });
    return false;
  }
  return true;
}

export function jsonBody(req: VercelRequest, maxBytes = DEFAULT_JSON_BODY_LIMIT) {
  const contentLength = Number(req.headers["content-length"] ?? 0);
  if (contentLength > maxBytes) throw new RequestValidationError(413, "Request body is too large.");
  if (typeof req.body === "string") {
    if (Buffer.byteLength(req.body, "utf8") > maxBytes) throw new RequestValidationError(413, "Request body is too large.");
    try {
      const parsed = JSON.parse(req.body);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new RequestValidationError(400, "A JSON object is required.");
      return parsed;
    } catch (error) {
      if (error instanceof RequestValidationError) throw error;
      throw new RequestValidationError(400, "Invalid JSON payload.");
    }
  }
  if (req.body && typeof req.body !== "object") throw new RequestValidationError(400, "A JSON object is required.");
  return req.body ?? {};
}

export function validEmail(value: unknown): value is string {
  return typeof value === "string" && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
