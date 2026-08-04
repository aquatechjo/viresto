# SEC-01/02 — Client Intake Access and Cron Authentication Hardening

Base commit: `89662d45e93afdf79e525ed3af6b96ca8694a500`

## SEC-01 — Client intake ownership

- Adds nullable `Client.createdById` with a tenant-safe composite foreign key.
- Records the authenticated creator for all newly created clients.
- Replaces the broad lawyer rule `cases: { none: {} }` with creator-scoped intake access.
- Keeps administrators unrestricted inside their tenant.
- Keeps staff restricted to assigned-case access.
- Prevents the cases API from using an inaccessible client to create or filter cases.
- Does not fabricate ownership for historical clients; legacy no-case records remain admin-only until assigned.

## SEC-02 — Constant-time bearer secret verification

- Adds one shared SHA-256 + `timingSafeEqual` verifier.
- Uses it for health-check and both Vercel cron routes.
- Preserves the existing fail-closed behavior when a secret is missing.

## Explicitly unchanged

The document-upload pipeline is not weakened or replaced. Its authenticated Cloudinary flow, content validation, limits, and rate limiting remain intact.

## Deployment order

1. Apply the source batch.
2. Run Prisma generation, lint, typecheck, unit tests, and production build.
3. Review the generated diff.
4. Apply the migration with `npm run db:deploy`.
5. Commit and push only after all checks succeed.
