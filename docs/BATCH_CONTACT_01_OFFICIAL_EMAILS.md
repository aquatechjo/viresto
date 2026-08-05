# BATCH CONTACT-01 — Official Aqua Tech Contact Emails

## Canonical addresses

- General and legal correspondence: `info@aquatechagency.com`
- Privacy, support, refunds, disputes, and security reports:
  `support@aquatechagency.com`

## Changes

- Added `src/config/contact.ts` as the canonical source.
- Updated the shared legal-policy footer.
- Updated privacy, terms, cancellation, refund, and dispute wording.
- Added the two addresses to the public homepage footer.
- Added `reply_to` to every Resend transactional email request.
- Updated `.env.example` with `EMAIL_REPLY_TO`.
- Added a regression test preventing restoration of the old Gmail address.

## Deployment

Keep `EMAIL_FROM` unchanged in Vercel until `aquatechagency.com` is verified
in Resend. The default reply-to address is safe to deploy immediately.
