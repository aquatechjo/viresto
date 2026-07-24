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
