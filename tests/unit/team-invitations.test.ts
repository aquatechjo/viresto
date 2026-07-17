import assert from "node:assert/strict";
import test from "node:test";
import {
  isTeamInvitationActive,
  teamInvitationExpiresAt,
} from "../../src/lib/team-invitations";

const now = new Date("2026-07-17T12:00:00.000Z");

test("only pending unexpired team invitations remain active", () => {
  assert.equal(
    isTeamInvitationActive(
      {
        acceptedAt: null,
        revokedAt: null,
        expiresAt: new Date("2026-07-17T12:00:01.000Z"),
      },
      now,
    ),
    true,
  );

  assert.equal(
    isTeamInvitationActive(
      {
        acceptedAt: now,
        revokedAt: null,
        expiresAt: new Date("2026-07-18T12:00:00.000Z"),
      },
      now,
    ),
    false,
  );

  assert.equal(
    isTeamInvitationActive(
      {
        acceptedAt: null,
        revokedAt: now,
        expiresAt: new Date("2026-07-18T12:00:00.000Z"),
      },
      now,
    ),
    false,
  );

  assert.equal(
    isTeamInvitationActive(
      {
        acceptedAt: null,
        revokedAt: null,
        expiresAt: now,
      },
      now,
    ),
    false,
  );
});

test("team invitation expiry is calculated from the supplied time", () => {
  assert.equal(
    teamInvitationExpiresAt(now).toISOString(),
    "2026-07-20T12:00:00.000Z",
  );
});
