# NEWSSA

NEWSSA is a news application backed by WordPress content, user accounts, saved articles, and newsletters.

## Tech stack

React, TypeScript, Vite, Vercel Functions, PostgreSQL, and WordPress REST API.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Required environment variables

Set these in local environment files or the Vercel project settings:

`POSTGRES_URL`, `AUTH_SESSION_SECRET`, `AUTH_ENCRYPTION_KEY`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `RESEND_TEMPLATE_ID`, `VITE_WORDPRESS_API`, `VITE_ALPHA_VANTAGE_API_KEY`, `CONTENT_DISTRIBUTION_PLATFORMS`, `CONTENT_DISTRIBUTION_DISPATCH_ENABLED`, `CONTENT_DISTRIBUTION_WEBHOOK_URL`, `CONTENT_DISTRIBUTION_WEBHOOK_SECRET`, `CONTENT_DISTRIBUTION_TIMESTAMP_TOLERANCE_SECONDS`, `CONTENT_DISTRIBUTION_WEBHOOK_TIMEOUT_MS`, `CONTENT_DISTRIBUTION_ADMIN_TOKEN`, and `CRON_SECRET`.

The content-distribution workflow is server-side only. Set `CONTENT_DISTRIBUTION_PLATFORMS` to a comma-separated list such as `facebook,instagram,linkedin,x`, keep `CONTENT_DISTRIBUTION_DISPATCH_ENABLED` at `false` until an external dispatcher is ready, and set `CONTENT_DISTRIBUTION_WEBHOOK_URL` plus `CONTENT_DISTRIBUTION_WEBHOOK_SECRET` only when the Zapier Catch Raw Hook is configured. `CONTENT_DISTRIBUTION_TIMESTAMP_TOLERANCE_SECONDS` defaults to `300`, and `CONTENT_DISTRIBUTION_WEBHOOK_TIMEOUT_MS` defaults to `10000`.

Phase 2A sends only a signed `content.distribution.requested` event to Zapier. It does not publish to social networks. The deterministic idempotency key is derived from the database job ID (`newssa-distribution-{jobId}`); the existing unique `(wordpress_post_id, source)` job constraint and `(job_id, platform)` publication constraint prevent duplicate job/publication identities. Signed callbacks use the same `X-NewsSA-Timestamp` and `X-NewsSA-Signature` scheme and require access to the original raw request body.

The internal `POST /api/automation/create-job` route requires `CONTENT_DISTRIBUTION_ADMIN_TOKEN` via a server-to-server Bearer token or `X-NewsSA-Admin-Token`. The token is server-only. Authentication and mutation routes use best-effort per-instance throttling; Vercel deployments still require a distributed edge or shared rate-limit service before treating those limits as a production-wide control.

Backend publication detection runs through the Vercel Cron route `GET /api/automation/detect-posts` every 15 minutes. Vercel supplies `CRON_SECRET` as a Bearer token for scheduled invocations; the existing admin token may be used for controlled manual `POST` testing. On first run, the detector processes only the existing latest-20 publication window and records progress in the durable `automation_checkpoints` table. Later runs query all published WordPress posts after the checkpoint, paginate deterministically by publication timestamp and post ID, and advance the checkpoint only after each article and its existing Phase 2A dispatch succeed. The existing `(wordpress_post_id, source)` uniqueness constraint prevents duplicate distribution jobs across retries or overlapping detection runs. Dispatch remains disabled unless explicitly enabled.

## Content distribution backend

The database schema stores a distribution job per WordPress article and one publication row per enabled platform. This is intentionally implemented in `database/schema.sql` and the serverless handlers under `api/automation/` without introducing a migration framework. The route handlers create the job, persist publication rows, and accept callback updates from the social dispatcher while using a dedicated secret instead of the user-session auth flow.

## Deployment

Import the repository into Vercel, configure the environment variables for the Production environment, and deploy using the existing Vite build configuration. Apply `database/schema.sql` to the configured PostgreSQL database before enabling account features.