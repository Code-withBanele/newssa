// Re-export all API functions from a single entry point

export * from "./posts";
export * from "./categories";
export * from "./authors";
export * from "./media";

/*
 * WEBHOOK / CACHE INVALIDATION INTEGRATION POINT
 *
 * When WordPress publishes, updates or deletes content it can trigger a
 * webhook.  Because this is a client-side React SPA there is no server
 * endpoint to receive the webhook directly.
 *
 * Recommended patterns for future implementation:
 *
 * 1. Serverless function (Vercel / Netlify / Cloudflare Workers):
 *    WordPress sends a POST to e.g. https://your-site.com/api/revalidate
 *    The function clears a CDN cache or sets a "stale" flag in a KV store.
 *    The SPA reads the flag on next load and skips its in-memory cache.
 *
 * 2. SWR / React Query cache invalidation:
 *    If you adopt React Query, call queryClient.invalidateQueries() from
 *    a BroadcastChannel message that the serverless function sends via
 *    a WebSocket / Server-Sent Event.
 *
 * 3. Polling fallback:
 *    The usePosts hook can accept a `refreshInterval` option and re-fetch
 *    on a schedule (e.g. every 60 s) without needing a webhook at all.
 *
 * The primary source of truth is always WordPress.  No frontend cache
 * should be treated as authoritative.
 */
