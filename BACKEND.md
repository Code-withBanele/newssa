# NewsSA backend architecture

The Vite client remains a WordPress reader. Account data, sessions, saved article relationships, and newsletter subscriptions belong behind Vercel serverless functions and PostgreSQL.

## Database

Apply `database/schema.sql` to a PostgreSQL database connected to the Vercel project. The schema creates:

- `users`: registered accounts, bcrypt password hashes, verification state, and encrypted TOTP secrets.
- `sessions`: hashed opaque session tokens with expiry. User deletion cascades to sessions.
- `saved_articles`: WordPress post IDs related to users. `UNIQUE (user_id, article_id)` prevents duplicate saves and user deletion cascades to saves.
- `newsletter_subscribers`: independent email subscriptions. `user_id` is nullable and active emails have a partial unique index; user deletion leaves a newsletter subscription intact.

WordPress article content is not copied into PostgreSQL. `article_id` is the public WordPress post ID.

## API routes

- `POST /api/auth/register`: validates input, hashes the password, creates a pending account, and returns a short-lived 2FA setup challenge plus `otpauth://` URI.
- `POST /api/auth/verify-2fa`: verifies the TOTP code, activates the account, and issues the HttpOnly session cookie.
- `POST /api/auth/login`: verifies the password and returns a short-lived 2FA challenge.
- `POST /api/auth/logout`: deletes the current server session.
- `GET /api/auth/me`: returns the current user from the session cookie.
- `GET|POST|DELETE /api/saved-articles`: reads, saves, or removes article IDs for the authenticated session only. The client cannot choose `user_id`.
- `POST /api/newsletter/subscribe`: creates or associates a newsletter subscription. It works with or without an authenticated session.

TOTP secrets are encrypted with AES-256-GCM at rest and never returned after setup. Session tokens are stored only as SHA-256 hashes in the database and sent to the browser as HttpOnly cookies.

## Environment variables

Configure these as server-side Vercel environment variables, never as `VITE_*` variables:

- `POSTGRES_URL`: PostgreSQL connection string from the Vercel/Neon integration.
- `AUTH_SESSION_SECRET`: long random secret used to sign short-lived 2FA challenges.
- `AUTH_ENCRYPTION_KEY`: 64 hexadecimal characters representing a 32-byte AES key.

The existing frontend still needs to be wired to these endpoints when the account/save UI is ready. At present, its sign-in modal and newsletter form are demo/local UI handlers; no fake database fallback was added. Guests should use a separate client-only save key such as `newssa_guest_saved_articles`, and those IDs must never be sent to `/api/saved-articles`.

## Deployment note

Vercel discovers TypeScript functions under `api/` automatically. `@vercel/postgres` is used for compatibility with Vercel's tagged SQL API; Vercel currently recommends a Neon integration for new projects, which can be adopted behind the same `POSTGRES_URL` contract.
