import type { VercelRequest, VercelResponse } from "@vercel/node";
import { siteUrl } from "./_lib/seo.js";

export default function handler(_req: VercelRequest, res: VercelResponse) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  return res.status(200).send(`User-agent: *\nAllow: /\nDisallow: /saved\nDisallow: /api/\nSitemap: ${siteUrl}/sitemap.xml\n`);
}