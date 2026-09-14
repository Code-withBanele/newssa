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

`POSTGRES_URL`, `AUTH_SESSION_SECRET`, `AUTH_ENCRYPTION_KEY`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `RESEND_TEMPLATE_ID`, `VITE_WORDPRESS_API`, `VITE_ALPHA_VANTAGE_API_KEY`, `CONTENT_DISTRIBUTION_PLATFORMS`, `CONTENT_DISTRIBUTION_DISPATCH_ENABLED`, and `CONTENT_DISTRIBUTION_WEBHOOK_SECRET`.

The content-distribution workflow is server-side only. Set `CONTENT_DISTRIBUTION_PLATFORMS` to a comma-separated list such as `facebook,instagram,linkedin,x`, keep `CONTENT_DISTRIBUTION_DISPATCH_ENABLED` at `false` until an external dispatcher is ready, and set `CONTENT_DISTRIBUTION_WEBHOOK_SECRET` to a strong shared secret when the callback endpoint is being used.

## Content distribution backend

The database schema stores a distribution job per WordPress article and one publication row per enabled platform. This is intentionally implemented in `database/schema.sql` and the serverless handlers under `api/automation/` without introducing a migration framework. The route handlers create the job, persist publication rows, and accept callback updates from the social dispatcher while using a dedicated secret instead of the user-session auth flow.

## Deployment

Import the repository into Vercel, configure the environment variables for the Production environment, and deploy using the existing Vite build configuration. Apply `database/schema.sql` to the configured PostgreSQL database before enabling account features.