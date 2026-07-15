import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

const pingTrend = new Trend("perf_ping_duration");
const dbTrend = new Trend("perf_db_duration");
const authTrend = new Trend("perf_auth_duration");

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
    perf_ping_duration: ["p(95)<100"],
    perf_db_duration: ["p(95)<350"],
    perf_auth_duration: ["p(95)<500"],
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

  const ping = http.get(`${BASE_URL}/api/perf/ping`, {
    tags: { name: "GET /api/perf/ping" },
  });

  pingTrend.add(ping.timings.duration);

  check(ping, {
    "ping 200": (r) => r.status === 200,
  });

  const db = http.get(`${BASE_URL}/api/perf/db`, {
    headers: authHeaders,
    tags: { name: "GET /api/perf/db" },
  });

  dbTrend.add(db.timings.duration);

  check(db, {
    "db 200": (r) => r.status === 200,
  });

  const auth = http.get(`${BASE_URL}/api/perf/auth`, {
    headers: authHeaders,
    tags: { name: "GET /api/perf/auth" },
  });

  authTrend.add(auth.timings.duration);

  check(auth, {
    "auth 200": (r) => r.status === 200,
  });

  sleep(0.3);
}
