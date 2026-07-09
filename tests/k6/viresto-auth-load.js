import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";
const TEST_EMAIL = __ENV.TEST_EMAIL;
const TEST_PASSWORD = __ENV.TEST_PASSWORD;

export const options = {
  stages: [
    { duration: "30s", target: 5 },
    { duration: "1m", target: 10 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1200"],
  },
};

export function setup() {
  if (!TEST_EMAIL || !TEST_PASSWORD) {
    throw new Error("Set TEST_EMAIL and TEST_PASSWORD env variables");
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
    },
  );

  check(loginRes, {
    "login succeeded": (r) => r.status === 200,
  });

  const tokenCookie = loginRes.cookies.ld_token?.[0]?.value;

  if (!tokenCookie) {
    throw new Error("Could not read ld_token cookie from login response");
  }

  return {
    cookie: `ld_token=${tokenCookie}`,
  };
}

export default function (data) {
  const headers = {
    Cookie: data.cookie,
    Origin: BASE_URL,
  };

  const pages = [
    "/dashboard",
    "/dashboard/clients",
    "/dashboard/cases",
    "/dashboard/appointments",
    "/dashboard/activity",
  ];

  for (const path of pages) {
    const res = http.get(`${BASE_URL}${path}`, { headers });

    check(res, {
      [`${path} status is 200`]: (r) => r.status === 200,
      [`${path} p response acceptable`]: (r) => r.timings.duration < 1500,
    });

    sleep(0.5);
  }
}