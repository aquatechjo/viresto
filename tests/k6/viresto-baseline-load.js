import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

// /api/perf/* were debug-only endpoints and are gone: measure a public page
// and the session-validated /api/auth/me (JWT + Session/User DB reads).
const pageTrend = new Trend("public_page_duration");
const authTrend = new Trend("auth_me_duration");

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 10 },
    { duration: "1m", target: 25 },
    { duration: "1m", target: 25 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    public_page_duration: ["p(95)<500"],
    auth_me_duration: ["p(95)<500"],
  },
};

export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    }),
    {
      headers: {
        "Content-Type": "application/json",
        Origin: BASE_URL,
      },
    },
  );

  const ok = check(loginRes, {
    "login status is 200": (r) => r.status === 200,
    "login cookie exists": (r) => Boolean(r.cookies.ld_token?.[0]?.value),
  });

  if (!ok) {
    console.error(loginRes.status);
    console.error(loginRes.body);
    throw new Error("Login failed.");
  }

  return {
    cookie: `ld_token=${loginRes.cookies.ld_token[0].value}`,
  };
}

export default function (data) {
  const authHeaders = {
    Cookie: data.cookie,
    Origin: BASE_URL,
  };

  const page = http.get(`${BASE_URL}/login`, {
    tags: { name: "GET /login" },
  });

  pageTrend.add(page.timings.duration);

  check(page, {
    "login page 200": (r) => r.status === 200,
  });

  const auth = http.get(`${BASE_URL}/api/auth/me`, {
    headers: authHeaders,
    tags: { name: "GET /api/auth/me" },
  });

  authTrend.add(auth.timings.duration);

  check(auth, {
    "auth/me 200": (r) => r.status === 200,
  });

  sleep(0.3);
}
