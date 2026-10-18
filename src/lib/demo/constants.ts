// Demo mode ("try with sample data"): shared by the server and the client.

// A request reached a demo office that may no longer be used (the owner's
// office subscribed or its trial ended, the real session ended, or the
// sandbox is gone). The response also switches the cookie back to the
// real session when it can, so the next request lands in the real office.
export const DEMO_ENDED_CODE = "DEMO_ENDED";

// A request a demo office may not make (billing, account security, team
// invitations, data requests): anything that sends email or touches money.
export const DEMO_BLOCKED_CODE = "DEMO_BLOCKED";
export const DEMO_BLOCKED_MESSAGE =
  "هذا الإجراء غير متاح في وضع التجربة. ارجع لمكتبك لاستخدامه.";

// Set on every DEMO_ENDED response so the client can leave without parsing.
export const DEMO_ENDED_HEADER = "x-viresto-demo-ended";

// Sandbox users get addresses on a reserved, undeliverable TLD (RFC 2606),
// so nothing can ever be mailed to them, and they can never log in.
export const DEMO_EMAIL_DOMAIN = "demo.viresto.invalid";

export function isDemoEmail(email: string) {
  return email.toLowerCase().endsWith(`@${DEMO_EMAIL_DOMAIN}`);
}
