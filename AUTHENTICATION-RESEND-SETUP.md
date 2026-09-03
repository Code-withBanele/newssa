# Authentication and Resend Setup

## Current Authentication Architecture

1. `POST /api/auth/register` validates the name, email, and 12-character minimum password, hashes the password with bcrypt, creates an unverified `users` row, generates a six-digit OTP with `crypto.randomInt`, stores only its SHA-256 hash and a 10-minute expiry, and sends the code through Resend.
2. Registration returns a signed 30-minute challenge containing the user ID and `registration` purpose. The challenge does not contain the OTP.
3. `POST /api/auth/login` validates the password and requires the account to have completed email verification. It replaces the stored OTP hash, resets attempts, sets a 10-minute expiry, sends the OTP, and returns a signed 30-minute `login` challenge.
4. `POST /api/auth/verify-2fa` validates the challenge purpose, expiry, OTP format, maximum of five failed attempts, code expiry, and the stored hash. A successful verification clears the OTP fields, marks the email and two-factor state as enabled, and creates a 30-day opaque session.
5. Session tokens are stored only as SHA-256 hashes in `sessions` and sent to the browser in an HttpOnly cookie. `GET /api/auth/me` reads that cookie; `POST /api/auth/logout` deletes the session and clears the cookie.
6. Invalid passwords, malformed requests, duplicate emails, invalid/expired challenges, incorrect codes, and excessive verification attempts return generic client-safe errors.

## Current Resend Integration

The integration is in `api/_lib/email.ts`. It uses the server-side `fetch` API to call `https://api.resend.com/emails` with a bearer token. The API key is read from `RESEND_API_KEY`; the sender is read from `AUTH_EMAIL_FROM`; and the Resend template is selected by the calling auth flow. The OTP is supplied as the template variable `OTP_CODE`.

`AUTH_EMAIL_FROM` must be a sender address allowed by Resend. In production, verify the sending domain in Resend and use an address on that domain. A single sender address may be used instead if Resend has separately approved it for the account. All templates must use the `OTP_CODE` variable.

The key is never read by the frontend and is never returned in an API response.

## Root Cause of the Current Error

`Email delivery is not configured.` originates in `api/_lib/email.ts` when any required server variable is missing. The local files show that `.env.local` does not define the Resend variables, while `.env.development.local` only defines the API key. The sender and template variables are therefore missing when the local Vercel wrapper starts, so the guard fails before a request reaches Resend.

This is an environment configuration problem, not a frontend or Resend API implementation problem. After configuration, an invalid sender/domain or template can still produce a Resend delivery failure, which is returned to clients only as a generic temporary email error.

## Resend Configuration - Step by Step

### 1. Create the Resend API key

In the Resend dashboard, create a sending API key with the minimum permission needed for transactional email. Keep it server-side. Do not prefix it with `VITE_`, commit it, or put it in browser code.

### 2. Configure environment variables

The application expects exactly these server-side names:

```env
POSTGRES_URL=your-postgres-connection-string
AUTH_SESSION_SECRET=a-long-random-secret
AUTH_ENCRYPTION_KEY=64-hexadecimal-characters
RESEND_API_KEY=your-resend-api-key
AUTH_EMAIL_FROM=NewsSA <no-reply@your-verified-do>
RESEND_TEMPLATE_ID=your-resend-template-id
```

For local development, put the values in `.env.local`. The `npm run dev:vercel` wrapper loads `.env.local` and passes the variables to Vercel's local runtime. Keep `.env.example` as a names-only template.

For production, add the same variables in the Vercel project settings for the required environments, then redeploy. Never use `VITE_RESEND_API_KEY`; Vite variables are client-visible.

### 3. Configure the sender

Set `AUTH_EMAIL_FROM` to the exact sender format accepted by Resend. Verify its domain in the Resend dashboard and configure the required DNS records before sending from that domain.

### 4. Configure the template

Create or select the initial verification template and set `RESEND_TEMPLATE_ID` to its ID. The resend-verification endpoint uses the separate template `8864c140-a061-44e6-bf2c-f81190eca3cc`. Both templates must render the dynamic variable `OTP_CODE`. The backend sends the code in the template variables object and does not include it in its response.

### 5. Registration and verification flow

```text
User registers
      |
Backend validates registration
      |
Generate OTP and store only its hash with a 10-minute expiry
      |
Send OTP through Resend
      |
Return a short-lived signed challenge
      |
User enters OTP
      |
Backend validates challenge, expiry, attempts, and OTP hash
      |
Mark account verified and create an HttpOnly session
```

### 6. Test locally

1. Apply `database/schema.sql` to the configured PostgreSQL database.
2. Fill all required server variables in `.env.local`.
3. Start the API-capable local server with `npm run dev:vercel`.
4. Open the Vite application URL shown by Vercel and register with a test mailbox.
5. Confirm the email arrives, enter the six-digit code, and confirm the authenticated account loads.
6. Log out, log in again, and verify the second OTP.
7. For a controlled failure test, temporarily use an invalid sender or template ID, confirm the UI shows a generic failure, then restore the valid value.

## OTP Flow

OTP values are generated with `crypto.randomInt`, are six digits including leading zeroes, and are never logged, returned, or stored in plaintext. Only the SHA-256 hash is stored in `verification_code_hash`. The expiration is stored in `verification_code_expires_at`. Five incorrect attempts invalidate further verification until a new code is requested. A successful verification clears the hash and expiry, so used codes cannot be reused.

## Resend OTP Flow

`POST /api/auth/resend-verification` accepts only the signed challenge. It verifies the challenge, checks that the account is still in the expected registration or login state, and applies a 60-second cooldown using the existing `users.updated_at` value. It then generates a new OTP, replaces the previous hash, resets attempts, assigns a new 10-minute expiry, sends the new code, and returns a newly signed challenge.

The modal masks the email address, shows `Sending...` while the request is active, shows a success message after delivery, and displays a generic retry message on failure. The button is disabled during the client countdown and the endpoint enforces the cooldown server-side. The challenge lifetime is 30 minutes so a user can request a new code after the original 10-minute OTP expires.

## Security Considerations

- Resend credentials remain server-side.
- OTPs are generated with a cryptographically secure random source.
- OTPs are hashed at rest and expire.
- Previous OTPs are replaced, attempts reset on replacement, and successful codes are cleared.
- Verification is server-side and limited to five failed attempts.
- Resend requests are challenge-bound and rate-limited by the database timestamp.
- API responses do not contain OTPs or provider credentials.
- Provider failures and configuration failures are presented as generic client-safe errors.
- Sessions use opaque random tokens, HttpOnly cookies, hashed database values, and expiry.

## Files Changed

- `api/_lib/email.ts`: centralized Resend configuration checks and safe delivery errors.
- `api/_lib/auth.ts`: allows auth challenges to outlive the OTP when needed for resend.
- `api/auth/register.ts`: validates email configuration before creating an account and returns a safe delivery status.
- `api/auth/login.ts`: validates email configuration before replacing the login OTP and returns a longer-lived challenge.
- `api/auth/resend-verification.ts`: new challenge-bound, cooldown-protected resend endpoint.
- `src/services/accountClient.ts`: new frontend API call for resend.
- `src/app/App.tsx`: masked recipient, resend action, cooldown, loading, success, and error states.
- `AUTHENTICATION-RESEND-SETUP.md`: this architecture, configuration, security, and test guide.

## Testing Checklist

- `npm run build`: passed after backend/client changes and after OTP UI changes.
- Valid registration and live OTP delivery: requires configured database, sender, template, and Resend credentials.
- Invalid registration and duplicate email: covered by existing validation and conflict handling.
- Correct, incorrect, expired, and used OTP: implemented in `verify-2fa.ts`; requires an API/database test run.
- Successful resend, cooldown, repeated rapid resend, resend after OTP expiry, and delivery failure: implemented in `resend-verification.ts`; requires an API/database test run.
- Secret exposure: Resend key is server-only and no OTP is returned or logged by the changed code.

A live Resend/database integration test was not run in this environment because it would send email and depends on external credentials and services.
