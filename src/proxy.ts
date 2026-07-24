import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";
import {
  buildContentSecurityPolicy,
  createCspNonce,
} from "@/lib/csp";
import { isMachineAuthenticatedPath } from "@/lib/request-path-policy";

const publicPaths = [
  "/",
  "/login",
  "/pricing",
  "/privacy",
  "/terms",
  "/subscription-policy",
  "/register",
  "/verify-email",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/verify-email",
  "/api/auth/resend-verification",
  "/forgot-password",
  "/reset-password",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/join-team",
  "/api/auth/team-invitation",
];

const exactPublicPaths = new Set(["/api/perf/ping"]);

function isPublicPath(pathname: string) {
  return (
    exactPublicPaths.has(pathname) ||
    publicPaths.some(
      (path) => pathname === path || pathname.startsWith(`${path}/`),
    )
  );
}

function shouldDisableCache(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/api/")
  );
}

function applyNoStoreHeaders(res: NextResponse) {
  res.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  );
  res.headers.set("Pragma", "no-cache");
  res.headers.set("Expires", "0");
  return res;
}

function applySecurityHeaders(res: NextResponse, csp: string) {
  const isProd = process.env.NODE_ENV === "production";

  if (isProd) {
    res.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }

  res.headers.set("X-DNS-Prefetch-Control", "off");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()",
  );

  res.headers.set("Content-Security-Policy", csp);

  return res;
}

function finalizeResponse(res: NextResponse, pathname: string, csp: string) {
  if (shouldDisableCache(pathname)) {
    applyNoStoreHeaders(res);
  }

  return applySecurityHeaders(res, csp);
}

function continueRequest(requestHeaders: Headers) {
  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

function unauthenticatedResponse(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      { ok: false, message: "غير مصرح لك بتنفيذ هذا الطلب" },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = createCspNonce();
  const csp = buildContentSecurityPolicy(
    nonce,
    process.env.NODE_ENV !== "production",
  );
  const requestHeaders = new Headers(req.headers);

  // Next.js reads the request CSP/nonce and adds it to framework scripts.
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const isAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/assets") ||
    pathname.includes(".");

  if (isAsset) {
    return applySecurityHeaders(NextResponse.next(), csp);
  }

  if (isMachineAuthenticatedPath(pathname)) {
    return finalizeResponse(continueRequest(requestHeaders), pathname, csp);
  }

  const publicRegisterEnabled =
    process.env.PUBLIC_REGISTER_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_REGISTER_ENABLED === "true";

  if (pathname === "/register" && !publicRegisterEnabled) {
    return finalizeResponse(
      NextResponse.redirect(new URL("/login", req.url)),
      pathname,
      csp,
    );
  }

  const token = req.cookies.get("ld_token")?.value;

  if (!token && !isPublicPath(pathname)) {
    const res = unauthenticatedResponse(req);
    return finalizeResponse(res, pathname, csp);
  }

  if (!token && isPublicPath(pathname)) {
    return finalizeResponse(continueRequest(requestHeaders), pathname, csp);
  }

  if (token) {
    try {
      const payload = await verifyToken(token);

      if (!payload) {
        const res = isPublicPath(pathname)
          ? continueRequest(requestHeaders)
          : unauthenticatedResponse(req);

        res.cookies.delete("ld_token");
        return finalizeResponse(res, pathname, csp);
      }

      requestHeaders.set("x-user-id", String(payload.userId));
      requestHeaders.set("x-tenant-id", String(payload.tenantId));
      requestHeaders.set("x-user-role", String(payload.role));

      if (
        pathname === "/login" ||
        pathname === "/register" ||
        pathname === "/verify-email" ||
        pathname === "/forgot-password" ||
        pathname === "/reset-password" ||
        pathname === "/join-team"
      ) {
        return finalizeResponse(
          NextResponse.redirect(new URL("/dashboard", req.url)),
          pathname,
          csp,
        );
      }

      const res = continueRequest(requestHeaders);

      return finalizeResponse(res, pathname, csp);
    } catch {
      const res = isPublicPath(pathname)
        ? continueRequest(requestHeaders)
        : unauthenticatedResponse(req);

      res.cookies.delete("ld_token");
      return finalizeResponse(res, pathname, csp);
    }
  }

  return finalizeResponse(continueRequest(requestHeaders), pathname, csp);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
