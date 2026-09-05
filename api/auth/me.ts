import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getSessionUser } from "../_lib/auth.js";
import { method } from "../_lib/http.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!method(req, res, "GET")) return;
  const user = await getSessionUser(req);
  return user ? res.status(200).json({ user }) : res.status(401).json({ error: "Authentication required." });
}
