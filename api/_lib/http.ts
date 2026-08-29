import type { VercelRequest, VercelResponse } from "@vercel/node";

export function method(req: VercelRequest, res: VercelResponse, expected: string) {
  if (req.method !== expected) {
    res.setHeader("Allow", expected);
    res.status(405).json({ error: "Method not allowed" });
    return false;
  }
  return true;
}

export function jsonBody(req: VercelRequest) {
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body ?? {};
}

export function validEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
