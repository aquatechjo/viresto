# Office data requests: export and deletion

AUDIT_REPORT.md M4. Offices hold their clients' personal data, so an office
must be able to take its data out and have it erased (Jordan's Personal Data
Protection Law, No. 24 of 2023). Both requests are made by the office **ADMIN**
from **Settings → Data export and office deletion**, and both work while the office is locked
(trial over or subscription ended).

## Export (self-service)

- `GET /api/data-requests/export`: ADMIN only, at most 5 exports per office
  per hour. Exempt from the subscription lock (`src/lib/request-path-policy.ts`).
- Returns one JSON file, `viresto-export-<office-slug>-<date>.json`:
  `format` (`viresto-office-export`), `version`, `exportedAt`, `office`,
  then `users`, `clients`, `cases`, `caseMembers`, `appointments`, `tasks`,
  `documents`, `invoices` (with `items`), `payments`, `subscriptions` and
  `activities`.
- Encrypted client fields are decrypted. Money amounts are decimal strings,
  so no precision is lost.
- Not exported: password hashes, 2FA secrets, the search hashes of encrypted
  fields, sessions, verification and reset codes, invitation tokens and
  notifications.
- **Document files are not in the JSON**, only their metadata (name, type,
  size, notes, tags, AI summary). The ADMIN downloads the files themselves from
  the same card (*Document files*), also while locked:
  - `GET /api/data-requests/documents` lists them (newest first, 100 per page,
    `?cursor=<last id>` for more).
  - `GET /api/data-requests/documents/<id>` downloads one file as an
    attachment. Only files under the office's own storage folder; at most 500
    downloads per office per hour; each download is logged as
    `DOCUMENT_FILE_EXPORTED` (audit, kept a year).
  - There is no ZIP of all files. If an office needs that, the operator can
    hand it over from Cloudinary (`Viresto/<tenantId>/documents/`).
- Each export is logged as `DATA_EXPORTED` (kept for a year, like other audit
  events). The response is streamed, and a failed read aborts the download
  rather than returning a cut-off file.

## Deletion (on request, done by the operator)

The office ADMIN presses **Send deletion request** (optional reason). Nothing is
deleted at that point.

`POST /api/data-requests/deletion` then:

1. logs `OFFICE_DELETION_REQUESTED` on the office (actor, email, reason);
2. sends every active system admin an in-app notification linking to
   `/admin?q=<office-slug>`;
3. emails the same system admins, with reply-to set to the requester (to
   `support@aquatechagency.com` if there are no system admins).

A second request within 24 hours returns `alreadyRequested: true` and notifies
no one again.

### Operator procedure

1. **Verify the request.** Reply to the email (it goes to the requester) and
   confirm the request with the office ADMIN. The requester is the logged-in
   ADMIN of that office, but confirm by email before deleting anything.
2. **Offer the data first.** Remind them to download the export and the
   document files from Settings → Data export and office deletion.
3. **Stop billing.** If the office has a live Polar subscription, cancel or
   revoke it in the Polar dashboard. The webhook syncs the office; deletion is
   refused while a subscription is `ACTIVE`/`TRIALING`.
4. **Suspend the office** in `/admin` (deletion is only allowed for suspended
   offices).
5. **Delete it** in `/admin` → office → *Permanent deletion* (type the office
   name and a reason). This deletes the office and all its rows (users,
   clients, cases, documents, invoices, payments, activity) and its
   Cloudinary files.
6. **Confirm to the requester** by email that the office was deleted. Database
   backups (Neon point-in-time history) age out on their own schedule.

The time from request to deletion is not yet stated in the privacy policy;
see PROJECT_STATUS.md for that open decision.
