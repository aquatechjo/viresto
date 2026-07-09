import http from "k6/http";
import { check, sleep } from "k6";
import { Trend } from "k6/metrics";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

const clientsTrend = new Trend("api_clients_duration");
const casesTrend = new Trend("api_cases_duration");
const appointmentsTrend = new Trend("api_appointments_duration");
const activityTrend = new Trend("api_activity_duration");

const now = new Date();
const from = new Date(now);
from.setDate(now.getDate() - 30);

const to = new Date(now);
to.setDate(now.getDate() + 60);

const ENDPOINTS = [
  {
    name: "clients",
    path: "/api/clients",
    trend: clientsTrend,
  },
  {
    name: "cases",
    path: "/api/cases",
    trend: casesTrend,
  },
  {
    name: "appointments",
    path: `/api/appointments?from=${encodeURIComponent(from.toISOString())}&to=${encodeURIComponent(to.toISOString())}`,
    trend: appointmentsTrend,
  },
  {
    name: "activity",
    path: "/api/activity",
    trend: activityTrend,
  },
];

export const options = {
stages: [
  { duration: "1m", target: 10 },
  { duration: "1m", target: 25 },
  { duration: "2m", target: 50 },
  { duration: "1m", target: 50 },
  { duration: "1m", target: 0 },
],
  thresholds: {
    http_req_failed: ["rate<0.02"],

    // Global API target
    http_req_duration: ["p(95)<1500"],

    // Per-endpoint diagnosis
    api_clients_duration: ["p(95)<1200"],
    api_cases_duration: ["p(95)<1200"],
    api_appointments_duration: ["p(95)<1200"],
    api_activity_duration: ["p(95)<1200"],
  },
};

export function setup() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error("Set TEST_EMAIL and TEST_PASSWORD first.");
  }

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
      tags: { name: "POST /api/auth/login" },
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
  const headers = {
    Cookie: data.cookie,
    Origin: BASE_URL,
  };

  for (const endpoint of ENDPOINTS) {
    const res = http.get(`${BASE_URL}${endpoint.path}`, {
      headers,
      tags: { name: `GET /api/${endpoint.name}` },
    });

    endpoint.trend.add(res.timings.duration);

    check(res, {
      [`${endpoint.name} status is 200`]: (r) => r.status === 200,
      [`${endpoint.name} under 1200ms`]: (r) => r.timings.duration < 1200,
      [`${endpoint.name} json response`]: (r) => {
        const contentType = r.headers["Content-Type"] || "";
        const body = String(r.body || "").trim();

        return (
          contentType.includes("application/json") ||
          body.startsWith("{") ||
          body.startsWith("[")
        );
      },
    });

    sleep(0.3);
  }
}