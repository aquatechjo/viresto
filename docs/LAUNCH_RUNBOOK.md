# Viresto — Launch-day runbook

Exact steps, in order, to ship `main` to production. Run every command from
the repo root in **PowerShell** on the launch machine. Do not skip a check:
each one guards the step after it.

Placeholders look like `<THIS>`. Never paste a secret into chat, a ticket or
this file. The commands below read secrets into PowerShell variables or pipe
them straight into the Vercel CLI, so they do not end up in a file.

What ships: everything on `main` after `origin/main` (`615024d`), i.e. the
pre-launch audit fixes (`AUDIT_REPORT.md`), the in-app trial, Polar billing
hardening, data export/deletion requests and the dark public pages. See
`PROJECT_STATUS.md` section 2.2.

---

## 0. Prerequisites (the day before)

- [ ] `main` pushed, and CI (`quality.yml`: lint, typecheck, unit, integration,
      drift check, build) green on that commit.
- [ ] Privacy policy states the 30-day deletion deadline, and
      `PRIVACY_VERSION` in `src/lib/legal-policy.ts` is bumped for it
      (OPERATIONS.md §6). Then update the last line of `docs/data-requests.md`.
- [ ] Tools installed and logged in:

```powershell
npm i -g vercel neonctl
vercel login
vercel link            # pick the "viresto" project in the aqua-tech team
neonctl auth
```

- [ ] Note the commit Production runs **now** (Vercel → Deployments →
      Production → Source). Needed for rollback (§9) and for the
      `SubscriptionPayment` check in §4.
- [ ] Note the Neon project id and the name of the Production branch:

```powershell
neonctl projects list
neonctl branches list --project-id <NEON_PROJECT_ID>
```

- [ ] A **production** env file for the scripts in §4 and §7, outside the
      repo, e.g. `C:\secure\viresto-prod.env`, containing only
      `DATABASE_URL` and `DIRECT_URL` (direct, non-pooler host) of the
      Production branch, plus `ENCRYPTION_KEY`, `ENCRYPTION_KEY_ID` and
      `SEARCH_HASH_SECRET` with the values **after** §1. Delete it at the end
      of the day.

---

## 1. Rotate the keys that were on the development machine

The local `.env` held production Polar, Resend, Cloudinary and Turnstile keys
(PROJECT_STATUS → "Waiting on you"). Rotate them now; env changes reach only
new deployments, so they go live with the deploy in §5.

Helper to replace one Production variable (paste once per PowerShell
session):

```powershell
# Writes the value through a temp file: a PowerShell pipe would append a
# newline to the secret.
function Set-ProdEnv([string]$Name, [string]$Value) {
  vercel env rm $Name production --yes 2>$null | Out-Null
  $tmp = New-TemporaryFile
  try {
    [IO.File]::WriteAllText($tmp.FullName, $Value)
    cmd /c "vercel env add $Name production < `"$($tmp.FullName)`""
  } finally { Remove-Item $tmp.FullName -Force }
}
function New-Secret([int]$Bytes = 48) {
  node -e "process.stdout.write(require('crypto').randomBytes($Bytes).toString('base64url'))"
}
```

### 1a. Third-party keys (new key in the provider first, then Vercel)

| Variable | Where to create the new value | Then |
|---|---|---|
| `POLAR_ACCESS_TOKEN` | Polar → Settings → Developers → new **production** token | revoke the old token after §6 passes |
| `POLAR_WEBHOOK_SECRET` | Polar → Settings → Webhooks → endpoint → regenerate secret | (webhooks fail with 403 until §5 is live; Polar retries them) |
| `RESEND_API_KEY` | Resend → API Keys → create (sending access, domain `virestojo.com`) | delete the old key after §6 |
| `CLOUDINARY_API_KEY` + `CLOUDINARY_API_SECRET` | Cloudinary → Settings → API Keys → generate a new pair | disable the old pair after §6 |
| `TURNSTILE_SECRET_KEY` | Cloudflare → Turnstile → site → rotate secret | |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash → database → reset token | `UPSTASH_REDIS_REST_URL` stays |
| `OPENAI_API_KEY` | OpenAI → API keys → new key | revoke the old one (it is also set as a Windows user variable on the dev machine: remove it there) |

```powershell
Set-ProdEnv POLAR_ACCESS_TOKEN (Read-Host "Polar token")
Set-ProdEnv POLAR_WEBHOOK_SECRET (Read-Host "Polar webhook secret")
Set-ProdEnv RESEND_API_KEY (Read-Host "Resend key")
Set-ProdEnv CLOUDINARY_API_KEY (Read-Host "Cloudinary key")
Set-ProdEnv CLOUDINARY_API_SECRET (Read-Host "Cloudinary secret")
Set-ProdEnv TURNSTILE_SECRET_KEY (Read-Host "Turnstile secret")
Set-ProdEnv UPSTASH_REDIS_REST_TOKEN (Read-Host "Upstash token")
Set-ProdEnv OPENAI_API_KEY (Read-Host "OpenAI key")
```

### 1b. App secrets (generated here)

Effects: `JWT_SECRET` signs everyone out (fine before launch);
`VERIFICATION_SECRET` / `PASSWORD_RESET_SECRET` void codes already emailed;
`CRON_SECRET` is sent by Vercel Cron automatically; `HEALTHCHECK_SECRET` must
also be updated in the `Production smoke` GitHub secret / monitor.

`SEARCH_HASH_SECRET` is rotated too. It keys the HMACs stored in
`Client.emailHash` / `phoneHash` / `nationalIdHash` (search and duplicate
detection), and there is no re-hash script, but production has **zero
clients** (checked 2026-10-02), so no stored hash depends on the old value.
Once clients exist, rotating it needs a re-hash script first.

```powershell
foreach ($n in "JWT_SECRET","VERIFICATION_SECRET","PASSWORD_RESET_SECRET","CRON_SECRET","HEALTHCHECK_SECRET","SEARCH_HASH_SECRET") {
  Set-ProdEnv $n (New-Secret)
}
```

### 1c. `ENCRYPTION_KEY`: clean rotation (no previous keys)

Decision (2026-10-02): a new key, and the old one is **not** kept. Production
holds exactly one encrypted value: one user's 2FA secret, in the legacy
format, under a key that is not available (Vercel hides sensitive values). No
client rows exist. That user's 2FA is cleared in §4 and they re-enroll after
launch, so nothing needs the old key.

`check-env` requires standard base64 (`A-Z a-z 0-9 + /`, `=` padding) that
decodes to exactly 32 bytes; `ENCRYPTION_KEY_ID` must match
`^[A-Za-z0-9._-]{1,40}$`. The generator below produces that (44 characters).

```powershell
$b = New-Object byte[] 32; [Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b); $newKey = [Convert]::ToBase64String($b); Remove-Variable b
Set-ProdEnv ENCRYPTION_KEY $newKey
Set-ProdEnv ENCRYPTION_KEY_ID ("k" + (Get-Date -Format "yyyyMMdd"))
vercel env rm ENCRYPTION_PREVIOUS_KEYS production --yes 2>$null   # must not exist
Remove-Variable newKey
```

Store the new key in the password manager. From now on it is the only key
that can read client fields and 2FA secrets; losing it makes them
unreadable. Rotating it again later must use the keyring
(`ENCRYPTION_PREVIOUS_KEYS`) once real data exists.

### 1d. Variables to set, check or delete

```powershell
Set-ProdEnv POLAR_ENVIRONMENT "production"        # the build fails otherwise (3ca156e)
vercel env rm POLAR_ORGANIZATION_ID production --yes   # no longer read
vercel env ls production
```

Confirm in the list: `DATABASE_URL`, `DIRECT_URL`, `APP_URL` and/or
`NEXT_PUBLIC_APP_URL` (`https://www.virestojo.com`), `EMAIL_FROM`,
`ALLOWED_SERVER_ACTION_ORIGINS`, `UPSTASH_REDIS_REST_URL`,
`CLOUDINARY_CLOUD_NAME`, `PUBLIC_REGISTER_ENABLED` =
`NEXT_PUBLIC_REGISTER_ENABLED` = `true`, `TURNSTILE_ENABLED=true`,
`NEXT_PUBLIC_TURNSTILE_SITE_KEY`. **Must not exist in Production:**
`E2E_RATE_LIMIT_BYPASS` (ignored there anyway) and
`PRISMA_TRANSACTION_TIMEOUT_MS` (test-only). `AUTH_CACHE_TTL_MS` is optional
(default 5000 ms).

---

## 2. Neon restore point

Create a backup branch of Production right before migrating (instant,
copy-on-write):

```powershell
$neonProject = "<NEON_PROJECT_ID>"
$prodBranch  = "<PRODUCTION_BRANCH_NAME>"
$backup = "pre-launch-" + (Get-Date -Format "yyyyMMdd-HHmm")
neonctl branches create --project-id $neonProject --parent $prodBranch --name $backup
```

Write down `$backup` and the UTC time.

---

## 3. Check what `db:deploy` will apply

```powershell
Get-Content C:\secure\viresto-prod.env | ForEach-Object {
  if ($_ -match '^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$') { Set-Item "env:$($Matches[1])" $Matches[2] }
}
npx prisma migrate status
```

Expected: exactly these five pending, in this order (nothing else, nothing
failed):

1. `20260922020000_drop_subscription_payment`: drops the `SubscriptionPayment` table (destructive; see §4).
2. `20260925000000_subscription_trial_starts_at`: adds nullable `Subscription.trialStartsAt`.
3. `20260925010000_subscription_past_due_since`: adds nullable `Subscription.pastDueSince`.
4. `20260930010000_processed_webhook`: new table `ProcessedWebhook` (webhook de-duplication).
5. `20261001000000_subscription_currency_default_usd`: column defaults only (`USD`).

(`20260930000000_add_public_ids` must already show as applied: it was marked
with `migrate resolve --applied` on 2026-09-30.) If the list differs, stop.

---

## 4. Migrate (`db:deploy`)

`SubscriptionPayment` check: the currently deployed code must not use it. It
was removed from the code in `5fd940d` (2026-09-22). If the Production commit
noted in §0 is **older** than `5fd940d`, `/admin` and tenant deletion will
error between this step and §5; keep that gap to minutes.

Confirm the table is empty: Neon console → SQL editor → Production branch:

```sql
SELECT count(*) FROM "SubscriptionPayment";
```

It must be `0`. If not, stop and export the rows first.

Then:

```powershell
npm run db:deploy
npx prisma migrate status      # "Database schema is up to date!"
```

**Clear the one 2FA enrolment** (§1c) now, before the new deployment goes
live: the new `ENCRYPTION_KEY` cannot decrypt the old secret, so that user
could not complete a 2FA login. In the Neon SQL editor on the Production
branch, first see who it is:

```sql
SELECT "email", "role", "isSystemAdmin"
FROM "User"
WHERE "twoFactorEnabled" = true OR "twoFactorSecret" IS NOT NULL;
```

Expect exactly one row. Then clear it (the same columns the app's own
"disable 2FA" clears; there are no backup or recovery codes in the schema):

```sql
UPDATE "User"
SET "twoFactorEnabled" = false,
    "twoFactorSecret"  = NULL,
    "updatedAt"        = now()
WHERE "twoFactorEnabled" = true OR "twoFactorSecret" IS NOT NULL;
```

It must report `UPDATE 1`. Run the `SELECT` again: no rows. After launch,
that user signs in with email and password and re-enables 2FA in Settings.

If `db:deploy` fails, go to §9.2. Do **not** deploy the app (§5) on a
partially migrated database: `requireAuth` reads the trial columns on every
request, and the Polar webhook reads `ProcessedWebhook` on every delivery.

---

## 5. Deploy the app

```powershell
git switch main
git pull --ff-only
git status          # must be clean
git push origin main
```

With the Git integration, Vercel builds `main` to Production (`prebuild` runs
the env check; the build fails if any required variable is missing or
`POLAR_ENVIRONMENT` is not `production`). Without it: `vercel deploy --prod`.
Watch it:

```powershell
vercel ls
vercel inspect <DEPLOYMENT_URL> --logs
```

The build does **not** run migrations (`build` = `prisma generate && next
build`); §4 must be done first.

---

## 6. Post-deploy configuration and smoke tests

### 6a. Smoke

```powershell
$env:PRODUCTION_URL = "https://www.virestojo.com"
$env:HEALTHCHECK_SECRET = Read-Host "New HEALTHCHECK_SECRET"
npm run smoke:production
```

All checks must pass (public pages 200, protected APIs 401, authenticated
`/api/health` 200).

### 6b. Billing catalogue and Polar

```powershell
npm run db:seed        # upserts the 3 BillingPlan rows (USD cents) only
```

Check in `prisma/seed.ts` that the product ids are the **production** Polar
products (29/290, 59/590, 119/1190 USD).

Polar dashboard:

- [ ] Settings → Webhooks → endpoint URL exactly
      `https://www.virestojo.com/api/billing/webhooks/polar`, format Raw/JSON,
      events: `subscription.created`, `subscription.active`,
      `subscription.updated`, `subscription.canceled`,
      `subscription.uncanceled`, `subscription.revoked`,
      `subscription.past_due`, `order.paid`, `order.refunded`.
- [ ] "Send test event": response must be 200 (403 = webhook secret
      mismatch, 401 = old deployment).
- [ ] Remove the free trial from the six products (the trial is now in-app).
- [ ] Redeliver the failed production delivery from before; it must activate
      office `cmughejyn0001149coe7u22sh` (PROJECT_STATUS §2.1).

### 6c. Move existing offices onto the in-app trial

```powershell
npx tsx --env-file=C:\secure\viresto-prod.env scripts/migrate-offices-to-app-trial.ts
```

Review the counts and list (b). Then:

```powershell
npx tsx --env-file=C:\secure\viresto-prod.env scripts/migrate-offices-to-app-trial.ts --apply
```

Decide the offices in list (b) by hand.

### 6d. Manual checks in the browser (private window)

- [ ] Landing, pricing, login, register, legal pages: dark, readable.
- [ ] Register a new office → verification email arrives (Resend) → login.
- [ ] Settings → upload a document (Cloudinary) and open it.
- [ ] Settings → Data export and office deletion → **Download office data**
      works. Do not press "Send deletion request" on a real office.

---

## 7. Live purchase and refund test

Use a fresh office registered in §6d and a real card; cheapest plan (BASIC
monthly, 29 USD).

1. Settings → Subscription → BASIC monthly → Polar checkout → pay.
2. Back in the app, the office is **PAID** within a minute (the confirm
   call or the `subscription.active` / `order.paid` webhook). Vercel logs:
   `[polar-webhook]` lines with status 200, no `superseded_subscription`
   unless expected.
3. `/admin`: the office shows the Polar subscription as active.
4. Polar → Orders → that order → **Refund** in full.
5. Within a minute: `[polar-webhook] refund_revoked` in the logs, the Polar
   subscription is revoked, and the office is locked: data pages redirect to
   billing, while Settings → data export still works.
6. Delete or suspend the test office in `/admin` (suspend, then Permanent
   deletion).

If step 2 does not unlock the office: Vercel logs for `[polar-webhook]`;
Polar → Webhooks → deliveries; `/api/billing/checkout/confirm` errors. Do not
announce the launch until 1-5 pass.

---

## 8. After launch

- [ ] Revoke the old provider keys from §1a.
- [ ] Delete `C:\secure\viresto-prod.env`.
- [ ] Give the dev machine its own keys (Polar sandbox, test Resend /
      Cloudinary / Turnstile keys, new local secrets, `APP_URL=http://localhost:3000`).
      `ENCRYPTION_KEY` locally must be the key the dev-branch data uses.
- [ ] Watch Vercel logs for `[polar-webhook]`, `[API_ERROR]` and
      `[RATE_LIMIT_UNAVAILABLE]` for the first days.
- [ ] Keep the Neon backup branch for at least 7 days, then delete it:
      `neonctl branches delete $backup --project-id $neonProject`.
- [ ] Update `PROJECT_STATUS.md` (deployed commit, date, anything that
      differed from this runbook).

---

## 9. Rollback

### 9.1 The deploy fails or the new version misbehaves

- **Build failed:** nothing changed for users; the old deployment keeps
  serving. Fix (usually a missing or wrong env var, shown by the env check)
  and push again. The database is already migrated, which the old code
  tolerates (nullable columns, new table, defaults), except `SubscriptionPayment`
  for code older than `5fd940d` (§4).
- **Live but broken:** Vercel → Deployments → previous Production deployment
  → **Instant Rollback** (or `vercel rollback <PREVIOUS_DEPLOYMENT_URL>`),
  then `npm run smoke:production`.
  - Caveat: a rolled-back deployment uses its **old** env, i.e. the old
    `ENCRYPTION_KEY` (and old `SEARCH_HASH_SECRET`) without the new ones. Client fields written by the new
    version are then unreadable until you roll forward. If real offices have
    written data, prefer a roll-forward fix over a rollback.
  - The old deployment also has the old Polar webhook secret: webhooks return
    403 and Polar retries them; they are processed after roll-forward.

### 9.2 `db:deploy` fails

1. `npx prisma migrate status` shows the failed migration. Prisma does not
   wrap a migration in one transaction, so it may be half applied.
2. Read the error. If the fix is clear (e.g. a lock timeout), make the
   database match either the before state or the after state of that one
   migration by hand in the Neon SQL editor, then:

```powershell
npx prisma migrate resolve --rolled-back <MIGRATION_NAME>   # if you undid it; then run db:deploy again
npx prisma migrate resolve --applied <MIGRATION_NAME>       # only if you completed it by hand
npm run db:deploy
```

3. If unsure, restore instead: Neon → Production branch → Restore to the time
   noted in §2 (or from branch `$backup`), then `npx prisma migrate status`
   must show the five migrations pending again. Do not deploy the app until
   `db:deploy` succeeds.

### 9.3 Restore after launch

Only for confirmed data loss or corruption (OPERATIONS.md §5): Neon Instant
Restore of the Production branch to a verified timestamp, then
`npx prisma migrate status` and the smoke workflow. Restoring discards every
write after that timestamp, including real payments' sync state; reconcile
with Polar afterwards.
