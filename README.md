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

`POSTGRES_URL`, `AUTH_SESSION_SECRET`, `AUTH_ENCRYPTION_KEY`, `RESEND_API_KEY`, `AUTH_EMAIL_FROM`, `RESEND_TEMPLATE_ID`, and `VITE_WORDPRESS_API`.

The site uses the WordPress REST API as the source of truth for article content and imagery. Account and saved-article data is stored in PostgreSQL, while email delivery uses the configured Resend project. No automated publishing or distribution workflow is enabled in the production app.

## Deployment

Import the repository into Vercel, configure the environment variables for the Production environment, and deploy using the existing Vite build configuration. Apply `database/schema.sql` to the configured PostgreSQL database before enabling account features.