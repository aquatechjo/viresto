import { test } from "node:test";
import assert from "node:assert/strict";
import { getClientIp } from "@/lib/client-ip";
import { getLocationFromHeaders } from "@/lib/geo";

function request(headers: Record<string, string>) {
  return new Request("http://localhost/api/auth/register", { headers });
}

test("client ip: a spoofed CF-Connecting-IP is ignored (the app is on Vercel, not behind Cloudflare)", () => {
  const ip = getClientIp(
    request({
      "cf-connecting-ip": "6.6.6.6",
      "x-real-ip": "203.0.113.7",
      "x-forwarded-for": "203.0.113.7",
    }),
  );

  assert.equal(ip, "203.0.113.7");
});

test("client ip: rotating CF-Connecting-IP never yields a new rate-limit bucket", () => {
  const ips = new Set(
    ["1.1.1.1", "2.2.2.2", "3.3.3.3"].map((spoofed) =>
      getClientIp(request({ "cf-connecting-ip": spoofed, "x-real-ip": "198.51.100.9" })),
    ),
  );

  assert.deepEqual([...ips], ["198.51.100.9"]);
});

test("client ip: x-real-ip first, then the first x-forwarded-for entry", () => {
  assert.equal(getClientIp(request({ "x-real-ip": " 203.0.113.1 " })), "203.0.113.1");
  assert.equal(
    getClientIp(request({ "x-forwarded-for": "203.0.113.2, 10.0.0.1" })),
    "203.0.113.2",
  );
});

test("client ip: no Vercel headers -> null (callers bucket it as 'unknown')", () => {
  assert.equal(getClientIp(request({ "cf-connecting-ip": "6.6.6.6" })), null);
  assert.equal(getClientIp(request({})), null);
});

test("geo: a spoofed cf-ipcountry is ignored; only Vercel's geo headers are used", () => {
  const spoofed = getLocationFromHeaders(new Headers({ "cf-ipcountry": "XX" }));
  assert.equal(spoofed.country, null);

  const vercel = getLocationFromHeaders(
    new Headers({ "x-vercel-ip-country": "JO", "x-vercel-ip-city": "Amman" }),
  );
  assert.deepEqual(vercel, { country: "JO", city: "Amman" });
});
