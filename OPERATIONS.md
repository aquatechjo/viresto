# Viresto Production Operations

This runbook covers production smoke monitoring, incident triage, application rollback, and Neon recovery. It intentionally avoids destructive database commands.

## 1. Enable authenticated readiness checks

Generate a dedicated secret. It must be different from `CRON_SECRET` and every authentication secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Configure the generated value in two places:

1. Vercel Production environment variable: `HEALTHCHECK_SECRET`.
2. GitHub repository Actions secret: `PRODUCTION_HEALTHCHECK_SECRET`.

Optionally set the GitHub Actions variable `PRODUCTION_URL`. If omitted, the workflow checks `https://www.virestojo.com`.

Redeploy once after adding the Vercel variable. Never place the secret in Git, logs, screenshots, issue text, or workflow variables. GitHub documents repository Actions secrets separately from non-secret variables: https://docs.github.com/actions/security-guides/using-secrets-in-github-actions

## 2. Production smoke monitoring

The `Production smoke` workflow runs hourly at minute 17 and can also be started manually. It uses Node only and does not install dependencies or mutate production data.

It verifies:

- the homepage, login, pricing, privacy, terms, subscription policy, and sitemap respond successfully;
- the public liveness endpoint returns `{ ok: true }`;
- authenticated and Cron endpoints reject anonymous requests;
- when the health secret is configured, the protected readiness endpoint confirms live database and Redis access;
- Cloudinary and Resend configuration is present;
- OpenAI is reported as optional when it is not configured.

A failed scheduled workflow is an operational alert. Review the failed check name before retrying. GitHub notes that scheduled workflows can be delayed during busy periods, which is why this workflow does not run at the start of the hour: https://docs.github.com/actions/using-workflows/events-that-trigger-workflows

## 3. Incident triage

1. Record the first observed failure time and affected workflow check.
2. Confirm the latest Vercel Production deployment and inspect its function logs.
3. Check Neon and Upstash service state before changing application code.
4. If only email, uploads, or AI are affected, keep unaffected functions available and inspect Resend, Cloudinary, or OpenAI respectively.
5. Do not run `prisma migrate dev`, `prisma db push`, `prisma migrate reset`, demo seeds, or ad-hoc destructive SQL in Production.

## 4. Application rollback

If a newly deployed application version causes the incident:

1. Open the Vercel project and select **Instant Rollback** from the Production deployment.
2. Select the last known-good Production deployment.
3. Complete the rollback and run the `Production smoke` workflow manually.
4. Keep the faulty Git commit for investigation; do not rewrite shared Git history.

Vercel rollback restores a previous build, but it does not roll back database data. It can also restore the previous deployment's environment and Cron configuration, so re-check those settings after rollback: https://vercel.com/docs/instant-rollback

## 5. Neon recovery

Use database restore only for confirmed data loss or corruption, not for an application-only defect.

1. Stop writes or place the application in maintenance mode if the incident is actively changing data.
2. Use Neon Time Travel Assist to inspect the intended historical point with read-only queries.
3. Compare schema and critical records before approving a restore.
4. Restore the root Production branch only after confirming the timestamp and impact.
5. Re-run `npx prisma migrate status`, then the Production smoke workflow.

Neon Instant Restore overwrites the selected branch state and briefly interrupts connections. Neon creates a backup branch of the pre-restore state, but the historical point must still be verified first: https://neon.com/docs/introduction/branch-restore

## 6. Routine readiness checklist

- Weekly: review failed Production smoke and Vercel function errors.
- Before every migration: confirm a usable Neon restore point and run `npx prisma migrate status`.
- Monthly: validate recovery on an isolated Neon branch, never on Production.
- After every rollback or restore: run smoke checks and verify login, billing access, uploads, notifications, and one read-only financial report.
- After legal text changes: update the version constants in `src/lib/legal-policy.ts`, then verify that new users record the new acceptance version.

## 7. Development environment

Local development never touches production: its own database branch, its own secrets, sandbox or empty third-party keys.

### Files

- `.env`: every development value, database URLs included. Next.js and the Prisma CLI both read it (Prisma never reads `.env.local`). Template: `.env.example`.
- `.env.local`: E2E variables only. Never a database URL: Next.js would use it and Prisma would not, so the two would silently talk to different databases.
- Neither is committed (`.gitignore` excludes `.env*` except `.env.example`). No production value belongs in either; production values live only in Vercel.

### Neon branches (checked in the Neon console, 2026-11-03)

| Branch | Endpoint id |
|---|---|
| `production` (Default) | `ep-noisy-rain-aqby4u2n` |
| `dev` | `ep-patient-cake-aqguafst` |

`ep-fancy-cake-aqcx4bb3`, which older local env files referred to, no longer exists in Neon (an old, deleted branch).

### Create the dev branch

1. Neon console → the project → Branches → create a branch (e.g. `dev`) from `production`.
2. Copy its pooled connection string into `DATABASE_URL` and its direct (non-pooler) one into `DIRECT_URL` in `.env`.
3. Set `PROD_DB_ENDPOINT_ID` in `.env` to the endpoint id (`ep-...`) of the production branch.
4. Check: `npx prisma migrate status` lists the same migrations as Production.
5. Wipe the copied data and seed the dev data (below). The branch starts as a copy of production, and its encrypted fields cannot be read with the dev keys anyway.

### Dev secrets

The dev branch uses its own secrets, generated for it and never shared with production: `JWT_SECRET`, `ENCRYPTION_KEY` (`ENCRYPTION_KEY_ID="dev"`, `ENCRYPTION_PREVIOUS_KEYS` empty), `SEARCH_HASH_SECRET`, `VERIFICATION_SECRET`, `PASSWORD_RESET_SECRET`, `CRON_SECRET`, `HEALTHCHECK_SECRET`. Data encrypted with the production keys cannot be decrypted locally, and that is intended.

Third parties: Turnstile uses Cloudflare's official test keys; Resend is empty (codes print to the dev server log); Polar takes a sandbox token only (`POLAR_ENVIRONMENT="sandbox"`); Cloudinary, Upstash, OpenAI and Sentry are empty until dev accounts exist for them.

### Reset the dev data

```bash
npm run db:reset
npm run seed:e2e
```

`db:reset` drops every table of the dev branch and re-applies the migrations (Prisma then runs `prisma/seed.ts`: the billing plans). `seed:e2e` creates the E2E login (`E2E_TEST_EMAIL` / `E2E_TEST_PASSWORD` in `.env.local`) as the admin of an active PRO office. For sample data, open demo mode in the app (`src/lib/demo`): it builds its own sandbox office.

**Never use Neon's "Reset from parent" once real offices exist.** It copies production, with real clients' data, onto this machine. Reset with `db:reset` and the seeds instead.

### The guard

`scripts/check-dev-keys.mjs` refuses to start:

- the dev server (from `next.config.js`, in the development-server phase only, so `next build` and Vercel never run it),
- and `npm run db:migrate`, `db:reset`, `db:studio` (their `pre` scripts, `--database`),

when `DATABASE_URL` or `DIRECT_URL` points at the Neon endpoint `PROD_DB_ENDPOINT_ID`, or at any Neon endpoint while `PROD_DB_ENDPOINT_ID` is empty (it cannot tell). There is no override for the database check.

The Neon endpoint id is the only part of a connection string that differs between branches: database name, user and region are the same, and the password changes on rotation. It survives a branch reset, and it is not a secret.

The dev server also refuses a Polar token unless `POLAR_ENVIRONMENT="sandbox"`, a Resend key with a production sender, and `APP_URL` / `NEXT_PUBLIC_APP_URL` on virestojo.com. `ALLOW_PRODUCTION_KEYS_IN_DEV=1` overrides these key checks, never the database check.

`npm run db:deploy` and `npm run db:seed` are not guarded: the launch runbook runs them against production on purpose.

## 8. Client contact backfill (run once, in the key rotation session)

`scripts/backfill-search-hashes.ts` brings every client's phone, email and national ID in line with the rules the app applies on save and search (phone E.164, national ID Latin digits, email lower case): it re-encrypts each changed field and every value not under the active key, address and notes included, and recomputes `phoneHash`, `emailHash` and `nationalIdHash` with the current `SEARCH_HASH_SECRET`.

Run it once, during the key rotation, after deploying the code that normalizes on save and search:

1. Confirm a Neon restore point of the production branch.
2. Put the new keys in a temporary env file (`ENCRYPTION_KEY`, `ENCRYPTION_KEY_ID`, `SEARCH_HASH_SECRET`), the old encryption key in `ENCRYPTION_PREVIOUS_KEYS`, and the production `DATABASE_URL`. Delete the file when done.
3. Dry run (reads only, prints counts and client publicIds, never a value):
   `npx tsx --env-file=<file> scripts/backfill-search-hashes.ts`
4. Review: unreadable rows (a missing key), clients of one office that would share a phone, email or national ID, values that do not normalize (kept as they are, hash cleared: fix them by hand).
5. Apply, naming the endpoint of `DATABASE_URL`:
   `npx tsx --env-file=<file> scripts/backfill-search-hashes.ts --apply --endpoint=ep-...`
   It refuses unreadable rows and duplicates unless `--skip-unreadable` / `--allow-collisions` are passed. Rows edited during the run are skipped and listed; run it again. `updatedAt` is kept.

Until it runs, search and the duplicate check also match the hashes rows saved before 2026-11-04 were given (`phoneSearchHashes` in `src/lib/encryption.ts`: the local `07...` form and the old cleanup). Remove those legacy forms after the backfill.

## 9. Preview deployments (deferred)

Decision of 2026-11-05: code goes straight to `main` (see `CLAUDE.md`), so Preview deployments are not used. This section is the plan for the day they are. Nothing in it needs code changes beyond what is already in place.

### State on 2026-11-05 (done by hand in Vercel)

- Deployment Protection (Vercel Authentication) is on for Preview.
- Old Preview deployments were deleted. A deployment keeps the variables it was built with, so they could still reach the production database.
- Ignored Build Step skips every build that is not production: `[ "$VERCEL_ENV" != "production" ] && exit 0`. Remove it only once Preview has its own values (below).
- `DATABASE_URL` and `DIRECT_URL` are scoped to Production only.
- Guard in code: `scripts/check-env.mjs` fails a build with `VERCEL_ENV=preview` when `DATABASE_URL` or `DIRECT_URL` is on the production Neon endpoint `ep-noisy-rain-aqby4u2n` (fixed in the script, not an env var).

### Preview values

"dev" means: the value from the local `.env` (the Neon `dev` branch and its secrets). Never copy a production value into Preview.

| Variable | Preview value |
|---|---|
| `DATABASE_URL` / `DIRECT_URL` | dev pooled / direct URL (`ep-patient-cake-aqguafst`) |
| `ENCRYPTION_KEY`, `SEARCH_HASH_SECRET` | dev, identical character for character (see below) |
| `ENCRYPTION_KEY_ID` | `dev` |
| `ENCRYPTION_PREVIOUS_KEYS` | not set |
| `JWT_SECRET`, `PASSWORD_RESET_SECRET`, `VERIFICATION_SECRET`, `CRON_SECRET`, `HEALTHCHECK_SECRET` | dev |
| `APP_URL`, `NEXT_PUBLIC_APP_URL` | `https://` + the Preview alias under test (never virestojo.com) |
| `ALLOWED_SERVER_ACTION_ORIGINS` | that alias's host, no protocol (wildcards are rejected) |
| `POLAR_ENVIRONMENT` | `sandbox` |
| `POLAR_ACCESS_TOKEN` | a sandbox.polar.sh token |
| `POLAR_WEBHOOK_SECRET` | the sandbox webhook secret, or any random 32+ characters |
| `UPSTASH_REDIS_REST_URL` / `_TOKEN` | a separate free Upstash database (required, see below) |
| `RESEND_API_KEY` | a separate Resend key |
| `EMAIL_FROM` | `Viresto Preview <onboarding@resend.dev>` (delivers to the Resend account owner only) |
| `EMAIL_REPLY_TO` | not set |
| `CLOUDINARY_*` (3) | a separate Cloudinary cloud; until one exists, non-empty dummies (uploads fail) |
| `TURNSTILE_SECRET_KEY` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Cloudflare's public test keys |
| `OPENAI_API_KEY` | not set (AI off), or a separate key with a spending cap |
| `TURNSTILE_ENABLED`, `PUBLIC_REGISTER_ENABLED`, `NEXT_PUBLIC_REGISTER_ENABLED`, `OPENAI_*_MODEL`, `NEXT_PUBLIC_SENTRY_*`, `SENTRY_*`, `APP_NAME`, `EMAIL_LOGO_FRAME`, `PRISMA_TRANSACTION_TIMEOUT_MS`, `AUTH_CACHE_TTL_MS` | same as production is fine (Sentry tags events `preview`) |

Never in Vercel: `PROD_DB_ENDPOINT_ID`, `ALLOW_PRODUCTION_KEYS_IN_DEV`, `ENV_VALIDATION_STRICT`, `E2E_*`, `INTEGRATION_DATABASE_URL`. `PRODUCTION_URL` belongs to GitHub Actions only. Vercel sets `VERCEL_ENV`, `NEXT_PUBLIC_VERCEL_ENV` and `VERCEL_GIT_COMMIT_SHA` itself.

**Encryption keys.** The dev branch is encrypted with the dev `ENCRYPTION_KEY` (id `dev`) and its search hashes use the dev `SEARCH_HASH_SECRET`. With another key, clients cannot be decrypted and phone search finds nobody. With the production keys, dev data becomes a mix of two keys, and a Preview leak becomes a leak of the production key. A distinct `JWT_SECRET` keeps production sessions from working on Preview and back.

### What an empty value does on Preview

Preview builds run with `NODE_ENV=production`, so `prebuild` runs `check-env.mjs` in strict mode.

The build fails when any of these is empty or invalid: `DATABASE_URL`, `DIRECT_URL`, the three Cloudinary values, both Upstash values, `RESEND_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `ALLOWED_SERVER_ACTION_ORIGINS`, `POLAR_ENVIRONMENT`, the 32+ character distinct secrets (`JWT_SECRET`, `PASSWORD_RESET_SECRET`, `VERIFICATION_SECRET`, `SEARCH_HASH_SECRET`, `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`), `ENCRYPTION_KEY` (base64 of 32 bytes), an `https://` `APP_URL`, and the Turnstile keys when registration is on.

The build passes but a feature breaks:

- Upstash dummy or down: every rate-limited route (login, register, forgot password) is refused, because the limiter fails closed in production. Preview is unusable without a real Upstash database.
- Resend dummy: no email, verification codes included.
- Cloudinary dummy: document and logo uploads fail.
- Polar sandbox: checkout does not work either way, because the dev `BillingPlan` rows hold production product ids.
- `OPENAI_API_KEY` empty: AI features off (a warning only).
- `HEALTHCHECK_SECRET` empty: `/api/health` answers 401.

Preview does not migrate: `migrate-production.mjs` runs only with `VERCEL_ENV=production`. Migrate the dev branch from a local machine. Crons run on Production only.

### Steps in Vercel, per variable

Order: `DATABASE_URL` and `DIRECT_URL` (done), then the three encryption values, then the rest.

1. Settings → Environment Variables → find the variable.
2. ⋯ → Edit: keep **Production** only (untick Preview and Development; Development is what `vercel env pull` reads by default). Do not change the value. Save.
3. Add New: the same name, the Preview value, Environments = **Preview** only (all Preview branches), **Sensitive** on. Save.
4. Repeat for every variable whose Preview value differs. The "same as production" ones may stay on both.
5. Filter the list by Preview: no row may be on Production and Preview at once, except the "same as production" ones.
6. Check team-level Shared Environment Variables: none may be linked to this project on Preview.
7. Production is untouched: its values did not change, and a change only applies to new deployments.
8. Last, remove the Ignored Build Step.

### Checking that Preview is on dev, without exposing a secret

- The build log shows `[ENV_OK]` and `[migrate-production] skipped: VERCEL_ENV=preview`. A build on the production database fails with `DATABASE_URL points at the production database`.
- Neon → `dev` branch → Monitoring: a connection appears after signing in on the Preview.
- Signing in with the dev E2E account shows an office with no clients. This is a hint, not proof: the account may also exist on production from before 2026-11-03.
- Optional code change: after the `HEALTHCHECK_SECRET` check, `/api/health` could also return the database endpoint id (the first label of the `DATABASE_URL` host) and `ENCRYPTION_KEY_ID`. Neither is a secret.

### Neon's Vercel integration

Not now. By default it creates one branch per Preview from the project's default branch, which is `production`: every Preview would get a copy of the real customer's data (unreadable without the production keys, but copied), branches pile up, and the integration writes the Preview `DATABASE_URL` itself. One manual `dev` branch is simpler and holds no customer data. Revisit only if each Preview needs its own database, and only if the integration can branch from `dev` (not checked in Neon's documentation).
