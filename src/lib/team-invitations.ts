import { createHash, randomBytes } from "node:crypto";

export const TEAM_INVITATION_TTL_HOURS = 72;

type TeamInvitationState = {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
};

export function isTeamInvitationActive(
  invitation: TeamInvitationState,
  now = new Date(),
) {
  return Boolean(
    !invitation.acceptedAt &&
      !invitation.revokedAt &&
      invitation.expiresAt.getTime() > now.getTime(),
  );
}

export function createTeamInvitationToken() {
  const token = randomBytes(32).toString("base64url");

  return {
    token,
    tokenHash: hashTeamInvitationToken(token),
  };
}

export function hashTeamInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function teamInvitationExpiresAt(from = new Date()) {
  return new Date(
    from.getTime() + TEAM_INVITATION_TTL_HOURS * 60 * 60 * 1000,
  );
}
