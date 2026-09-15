import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createJobHandler, detectPostsHandler, socialStatusHandler } from "./_lib/automation-handlers.js";

export type AutomationAction = "create-job" | "detect-posts" | "social-status";

export function resolveAutomationAction(req: VercelRequest): AutomationAction | null {
  const actionValue = req.query.action;
  const action = Array.isArray(actionValue) ? actionValue[0] : actionValue;
  return action === "create-job" || action === "detect-posts" || action === "social-status" ? action : null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = resolveAutomationAction(req);

  if (action === "create-job") return createJobHandler(req, res);
  if (action === "detect-posts") return detectPostsHandler(req, res);
  if (action === "social-status") return socialStatusHandler(req, res);
  return res.status(404).json({ error: "Automation action not found." });
}
