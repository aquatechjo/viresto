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
npm run db:seed
ALLOW_DEMO_SEED=true DEMO_ADMIN_PASSWORD=<12+ characters> npm run db:seed:demo
```

`db:reset` drops every table of the dev branch and re-applies the migrations (Prisma then runs `prisma/seed.ts`).

**Never use Neon's "Reset from parent" once real offices exist.** It copies production, with real clients' data, onto this machine. Reset with `db:reset` and the seeds instead.

### The guard

`scripts/check-dev-keys.mjs` refuses to start:

- the dev server (from `next.config.js`, in the development-server phase only, so `next build` and Vercel never run it),
- and `npm run db:migrate`, `db:reset`, `db:studio`, `db:seed:demo` (their `pre` scripts, `--database`),

when `DATABASE_URL` or `DIRECT_URL` points at the Neon endpoint `PROD_DB_ENDPOINT_ID`, or at any Neon endpoint while `PROD_DB_ENDPOINT_ID` is empty (it cannot tell). There is no override for the database check.

The Neon endpoint id is the only part of a connection string that differs between branches: database name, user and region are the same, and the password changes on rotation. It survives a branch reset, and it is not a secret.

The dev server also refuses a Polar token unless `POLAR_ENVIRONMENT="sandbox"`, a Resend key with a production sender, and `APP_URL` / `NEXT_PUBLIC_APP_URL` on virestojo.com. `ALLOW_PRODUCTION_KEYS_IN_DEV=1` overrides these key checks, never the database check.

`npm run db:deploy` and `npm run db:seed` are not guarded: the launch runbook runs them against production on purpose.
