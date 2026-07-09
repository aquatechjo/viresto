import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:3000";

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/login`);

  check(res, {
    "login page status is 200": (r) => r.status === 200,
    "login page loads fast enough": (r) => r.timings.duration < 800,
  });

  sleep(1);
}