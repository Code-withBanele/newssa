import type { VercelRequest, VercelResponse } from "@vercel/node";
import { deleteSession, clearSessionCookie } from "../_lib/auth";
import { method } from "../_lib/http";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "POST")) return;
  await deleteSession(req);
  clearSessionCookie(res);
  return res.status(204).end();
}
