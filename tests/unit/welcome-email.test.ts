import { test, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";

// The welcome email goes out once per office, to its founder, on the
// founder's first successful email verification (POST /api/auth/verify-email).
// The real route, src/lib/welcome-email.ts and the renderer run; the DB, the code check,
// after(), Sentry and the HTTP call to Resend are mocked.

type MockUser = {
  id: string;
  tenantId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  isSystemAdmin: boolean;
  emailVerifiedAt: Date | null;
  twoFactorEnabled: boolean;
  createdAt: Date;
};

type MockTenant = {
  name: string;
  isDemo: boolean;
  isSuspended: boolean;
  status: string;
  trialEndsAt: Date | null;
  welcomeEmailSentAt: Date | null;
};

const TRIAL_END = new Date("2026-11-06T10:00:00Z");
let users: MockUser[] = [];
let tenants = new Map<string, MockTenant>();

function sameTime(a: Date | null, b: Date | null) {
  return a === b || (a instanceof Date && b instanceof Date && a.getTime() === b.getTime());
}

mock.module("@/lib/prisma", {
  namedExports: {
    prisma: {
      user: {
        findFirst: async ({ where }: { where: { email?: string; tenantId?: string } }) => {
          if (where.email) {
            const user = users.find((u) => u.email === where.email);
            if (!user) return null;
            const tenant = tenants.get(user.tenantId)!;
            return { ...user, tenant: { isSuspended: tenant.isSuspended, status: tenant.status } };
          }

          const inTenant = users
            .filter((u) => u.tenantId === where.tenantId)
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
          return inTenant[0] ?? null;
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<MockUser> }) => {
          const user = users.find((u) => u.id === where.id)!;
          Object.assign(user, data);
          return user;
        },
      },
      session: {
        create: async () => ({ id: "session-1" }),
      },
      tenant: {
        findUnique: async ({ where }: { where: { id: string } }) => {
          const tenant = tenants.get(where.id);
          return tenant ? { ...tenant } : null;
        },
        updateMany: async ({
          where,
          data,
        }: {
          where: { id: string; welcomeEmailSentAt: Date | null };
          data: { welcomeEmailSentAt: Date | null };
        }) => {
          const tenant = tenants.get(where.id);
          if (!tenant || !sameTime(tenant.welcomeEmailSentAt, where.welcomeEmailSentAt)) {
            return { count: 0 };
          }
          tenant.welcomeEmailSentAt = data.welcomeEmailSentAt;
          return { count: 1 };
        },
      },
    },
  },
});

class RateLimitUnavailableError extends Error {}

mock.module("@/lib/rate-limit", {
  namedExports: {
    RateLimitUnavailableError,
    checkRateLimit: async () => ({ allowed: true, remaining: 9, resetAt: Date.now() + 60_000 }),
  },
});
mock.module("@/lib/verification", {
  namedExports: { verifyCode: async () => ({ ok: true }) },
});
mock.module("@/lib/auth", {
  namedExports: {
    signToken: async () => "jwt",
    buildCookie: (token: string) => ({ name: "ld_token", value: token }),
  },
});
mock.module("@/lib/geo", {
  namedExports: { getLocationFromHeaders: () => ({ country: null, city: null }) },
});
mock.module("@/lib/log-activity", {
  namedExports: { logActivity: async () => undefined },
});

const reported: { error: unknown; tags: Record<string, string> }[] = [];

mock.module("@/lib/monitoring", {
  namedExports: {
    reportError: (error: unknown, tags: Record<string, string> = {}) => {
      reported.push({ error, tags });
    },
  },
});

type ResendCall = { headers: Record<string, string>; body: Record<string, unknown> };
const resendCalls: ResendCall[] = [];
let resendStatus = 200;

mock.module("@/lib/external-fetch", {
  namedExports: {
    externalFetch: async (_url: string, init: RequestInit) => {
      resendCalls.push({
        headers: init.headers as Record<string, string>,
        body: JSON.parse(String(init.body)),
      });
      return new Response(JSON.stringify(resendStatus === 200 ? { id: "re_welcome_1" } : { message: "boom" }), {
        status: resendStatus,
      });
    },
  },
});

// after(): tasks wait until a test flushes them, as on Vercel.
let afterTasks: (() => Promise<void>)[] = [];

mock.module("@/lib/after-response", {
  namedExports: {
    runAfterResponse: async (task: () => Promise<void>) => {
      afterTasks.push(task);
    },
  },
});

async function flushAfter() {
  const tasks = afterTasks;
  afterTasks = [];
  for (const task of tasks) await task();
}

let POST: (typeof import("../../src/app/api/auth/verify-email/route"))["POST"];
let welcome: typeof import("../../src/lib/welcome-email");
let formatAmmanTime: (typeof import("../../src/lib/email/layout"))["formatAmmanTime"];
let renderWelcomeEmail: (typeof import("../../src/lib/email/welcome-email"))["renderWelcomeEmail"];
let WELCOME_EMAIL_SUBJECT: string;

before(async () => {
  ({ POST } = await import("../../src/app/api/auth/verify-email/route"));
  welcome = await import("../../src/lib/welcome-email");
  ({ formatAmmanTime } = await import("../../src/lib/email/layout"));
  ({ renderWelcomeEmail, WELCOME_EMAIL_SUBJECT } = await import("../../src/lib/email/welcome-email"));
});

function addUser(user: Partial<MockUser> & Pick<MockUser, "id" | "tenantId" | "email" | "createdAt">) {
  users.push({
    name: "مستخدم",
    role: "ADMIN",
    isActive: true,
    isSystemAdmin: false,
    emailVerifiedAt: null,
    twoFactorEnabled: false,
    ...user,
  });
}

beforeEach(() => {
  users = [];
  tenants = new Map();
  tenants.set("tenant-1", {
    name: "مكتب الحسن & شركاه",
    isDemo: false,
    isSuspended: false,
    status: "TRIAL",
    trialEndsAt: TRIAL_END,
    welcomeEmailSentAt: null,
  });
  addUser({
    id: "founder",
    tenantId: "tenant-1",
    name: "أحمد",
    email: "founder@office.jo",
    createdAt: new Date("2026-10-23T08:00:00Z"),
  });
  addUser({
    id: "member",
    tenantId: "tenant-1",
    name: "سارة",
    email: "member@office.jo",
    role: "LAWYER",
    createdAt: new Date("2026-10-23T09:00:00Z"),
  });

  resendCalls.length = 0;
  reported.length = 0;
  resendStatus = 200;
  afterTasks = [];

  process.env.RESEND_API_KEY = "re_test_key";
  process.env.EMAIL_FROM = "Viresto <verify@virestojo.com>";
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.jo/";
});

mock.method(console, "info", () => undefined);
mock.method(console, "error", () => undefined);

async function verify(email: string) {
  const res = await POST(
    new NextRequest("http://localhost:3000/api/auth/verify-email", {
      method: "POST",
      body: JSON.stringify({ email, code: "123456" }),
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        host: "localhost:3000",
        "x-real-ip": "203.0.113.9",
      },
    }),
  );
  await flushAfter();
  return res;
}

test("the founder's first verification sends the template to the address that was verified", async () => {
  const res = await verify("founder@office.jo");

  assert.equal(res.status, 200);
  assert.equal(resendCalls.length, 1);

  const { headers, body } = resendCalls[0];
  assert.equal(body.to, "founder@office.jo");
  assert.equal(body.from, "Viresto <verify@virestojo.com>");
  assert.equal(body.subject, WELCOME_EMAIL_SUBJECT);
  assert.equal(body.template, undefined, "rendered in code, not a Resend template");
  assert.equal(headers["Idempotency-Key"], "welcome/tenant-1");

  const html = String(body.html);
  const text = String(body.text);
  assert.ok(html.includes("أهلاً أحمد، مكتبك جاهز"));
  assert.ok(html.includes("مكتب الحسن &amp; شركاه"), "office name from the DB, escaped once");
  assert.ok(html.includes(formatAmmanTime(TRIAL_END)), "the office's real trial end");
  assert.match(html, /href="https:\/\/app\.example\.jo\/dashboard"/);
  assert.ok(text.includes("مكتب الحسن & شركاه"), "the text part is not HTML-escaped");
  assert.ok(text.includes("https://app.example.jo/dashboard"));
  assert.ok(tenants.get("tenant-1")!.welcomeEmailSentAt instanceof Date);
});

test("the recipient is whoever verified, read from the database", async () => {
  users[0].email = "another-owner@law.jo";

  await verify("another-owner@law.jo");

  assert.equal(resendCalls.length, 1);
  assert.equal(resendCalls[0].body.to, "another-owner@law.jo");
});

test("a team member's verification sends nothing", async () => {
  await verify("member@office.jo");

  assert.equal(resendCalls.length, 0);
  assert.equal(tenants.get("tenant-1")!.welcomeEmailSentAt, null);
});

test("an office that already had its welcome email gets no second one", async () => {
  tenants.get("tenant-1")!.welcomeEmailSentAt = new Date("2026-10-22T00:00:00Z");

  await verify("founder@office.jo");

  assert.equal(resendCalls.length, 0);
});

test("of two concurrent verifications only the one that claims the office sends", async () => {
  await Promise.all([
    welcome.sendWelcomeEmailAfterVerification({ userId: "founder", tenantId: "tenant-1" }),
    welcome.sendWelcomeEmailAfterVerification({ userId: "founder", tenantId: "tenant-1" }),
  ]);

  assert.equal(resendCalls.length, 1);
});

test("a verified address does not verify again, so no welcome", async () => {
  users[0].emailVerifiedAt = new Date("2026-10-22T00:00:00Z");

  const res = await verify("founder@office.jo");

  assert.equal(res.status, 200);
  assert.equal(resendCalls.length, 0);
});

test("a demo sandbox office never gets one", async () => {
  tenants.get("tenant-1")!.isDemo = true;

  await verify("founder@office.jo");

  assert.equal(resendCalls.length, 0);
});

test("a failed send does not fail verification, goes to Sentry and releases the claim", async () => {
  resendStatus = 500;

  const res = await verify("founder@office.jo");

  assert.equal(res.status, 200);
  assert.equal(resendCalls.length, 1);
  assert.equal(reported.length, 1);
  assert.deepEqual(reported[0].tags, { area: "email", flow: "welcome" });
  assert.equal(tenants.get("tenant-1")!.welcomeEmailSentAt, null);
});

test("with no API key outside production nothing is sent and the office stays unclaimed", async () => {
  delete process.env.RESEND_API_KEY;

  const res = await verify("founder@office.jo");

  assert.equal(res.status, 200);
  assert.equal(resendCalls.length, 0);
  assert.equal(tenants.get("tenant-1")!.welcomeEmailSentAt, null);
});

test("empty names fall back to a polite default", () => {
  const { html, text } = renderWelcomeEmail({ userName: "  ", officeName: null, trialEndsAt: TRIAL_END });

  assert.ok(html.includes("أهلاً حضرة المحامي، مكتبك جاهز"));
  assert.ok(html.includes(">مكتبك</span>"));
  assert.ok(text.includes("أهلاً حضرة المحامي"));
});

test("names are HTML-escaped exactly once in the HTML and left as typed in the text part", () => {
  const { html, text } = renderWelcomeEmail({
    userName: "Qusai & Co <i>i</i>",
    officeName: 'مكتب "الحسن" & شركاه <b>x</b>',
    trialEndsAt: TRIAL_END,
  });

  assert.ok(html.includes("Qusai &amp; Co &lt;i&gt;i&lt;/i&gt;"));
  assert.ok(html.includes("مكتب &quot;الحسن&quot; &amp; شركاه &lt;b&gt;x&lt;/b&gt;"));
  assert.ok(!html.includes("<b>x</b>") && !html.includes("<i>i</i>"), "no injected tag");
  assert.ok(!html.includes("&amp;amp;"), "not escaped twice");
  assert.ok(text.includes('مكتب "الحسن" & شركاه <b>x</b>'));
});
