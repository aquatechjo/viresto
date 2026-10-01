import assert from "node:assert/strict";
import { randomInt } from "node:crypto";
import { NextRequest } from "next/server";

// Shared by integration tests that need real, logged-in offices: drives the
// real register -> verify-email -> login routes. The caller passes the
// route handlers (imported after setupIntegrationDatabase) and the map its
// email mock fills with verification codes.

export const ORIGIN = "http://localhost:3000";
export const TEST_PASSWORD = "Integration#Pass1";

type PostHandler = (req: NextRequest) => Promise<Response>;

let ipCounter = 1;

export function apiRequest(method: string, pathname: string, cookie?: string, body?: unknown) {
  return new NextRequest(`${ORIGIN}${pathname}`, {
    method,
    ...(body === undefined || method === "GET" ? {} : { body: JSON.stringify(body) }),
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      host: "localhost:3000",
      "x-forwarded-host": "localhost:3000",
      // A fresh address per request keeps the per-IP limiters out of the way.
      "x-forwarded-for": `10.20.${Math.floor(ipCounter / 250)}.${(ipCounter++ % 250) + 1}`,
      ...(cookie ? { cookie } : {}),
    },
  });
}

export function sessionCookie(response: Response) {
  const cookie = response.headers
    .getSetCookie()
    .find((value) => value.startsWith("ld_token="))
    ?.split(";")[0];
  assert.ok(cookie, "session cookie issued");
  return cookie;
}

export function createOfficeTools(deps: {
  prisma: { user: { findUniqueOrThrow(args: unknown): Promise<{ id: string; tenantId: string }> } };
  registerPOST: PostHandler;
  verifyEmailPOST: PostHandler;
  loginPOST: PostHandler;
  verificationCodes: Map<string, string>;
}) {
  async function login(email: string, password = TEST_PASSWORD) {
    const response = await deps.loginPOST(apiRequest("POST", "/api/auth/login", undefined, { email, password }));
    assert.equal(response.status, 200, await response.clone().text());
    return sessionCookie(response);
  }

  async function registerOffice(label: string) {
    const email = `it-${label}-${Date.now()}-${randomInt(1e6)}@example.com`;

    const registered = await deps.registerPOST(
      apiRequest("POST", "/api/auth/register", undefined, {
        tenantName: `IT ${label}`,
        name: `Admin ${label}`,
        email,
        phone: `07${String(randomInt(1e8)).padStart(8, "0")}`,
        password: TEST_PASSWORD,
        acceptTerms: true,
        acceptPrivacy: true,
      }),
    );
    assert.equal(registered.status, 201, await registered.clone().text());

    const verified = await deps.verifyEmailPOST(
      apiRequest("POST", "/api/auth/verify-email", undefined, {
        email,
        code: deps.verificationCodes.get(email),
      }),
    );
    assert.equal(verified.status, 200, await verified.clone().text());

    const cookie = await login(email);
    const user = await deps.prisma.user.findUniqueOrThrow({
      where: { email },
      select: { id: true, tenantId: true },
    });

    return { email, cookie, userId: user.id, tenantId: user.tenantId };
  }

  return { registerOffice, login };
}
