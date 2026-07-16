import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifyToken } from "@/lib/auth";

const publicPaths = [
  "/",
  "/login",
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

// These routes authenticate machine-to-machine requests inside their handlers.
// Keep this list exact so no sibling API route bypasses the user session check.
const machineAuthenticatedPaths = new Set([
  "/api/cron/prune-activity",
  "/api/cron/generate-notifications",
]);

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

function applySecurityHeaders(res: NextResponse) {
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

  const isDev = process.env.NODE_ENV !== "production";
  const turnstileSrc = "https://challenges.cloudflare.com";

  const scriptSrc = isDev
    ? `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${turnstileSrc};`
    : `script-src 'self' 'unsafe-inline' ${turnstileSrc};`;

  const scriptSrcElem = `script-src-elem 'self' 'unsafe-inline' ${turnstileSrc};`;

  res.headers.set(
    "Content-Security-Policy",
    `
    default-src 'self';
    worker-src 'self' blob:;
    ${scriptSrc}
    ${scriptSrcElem}
    img-src 'self' data: blob: https://res.cloudinary.com;
    connect-src 'self' https://api.cloudinary.com https://res.cloudinary.com https://api.openai.com https://*.upstash.io https://*.vercel-insights.com https://*.vercel-analytics.com https://challenges.cloudflare.com;
    frame-src 'self' https://res.cloudinary.com https://challenges.cloudflare.com;
    frame-ancestors 'none';
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' data: https://fonts.gstatic.com;
    object-src 'none';
    base-uri 'self';
    form-action 'self';
  `
      .replace(/\s{2,}/g, " ")
      .trim(),
  );

  return res;
}

function finalizeResponse(res: NextResponse, pathname: string) {
  if (shouldDisableCache(pathname)) {
    applyNoStoreHeaders(res);
  }

  return applySecurityHeaders(res);
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

  const isAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/assets") ||
    pathname.includes(".");

  if (isAsset) {
    return applySecurityHeaders(NextResponse.next());
  }

  if (machineAuthenticatedPaths.has(pathname)) {
    return finalizeResponse(NextResponse.next(), pathname);
  }

  const publicRegisterEnabled =
    process.env.PUBLIC_REGISTER_ENABLED === "true" ||
    process.env.NEXT_PUBLIC_REGISTER_ENABLED === "true";

  if (pathname === "/register" && !publicRegisterEnabled) {
    return finalizeResponse(
      NextResponse.redirect(new URL("/login", req.url)),
      pathname,
    );
  }

  const token = req.cookies.get("ld_token")?.value;

  if (!token && !isPublicPath(pathname)) {
    const res = unauthenticatedResponse(req);
    return finalizeResponse(res, pathname);
  }

  if (!token && isPublicPath(pathname)) {
    return finalizeResponse(NextResponse.next(), pathname);
  }

  if (token) {
    try {
      const payload = await verifyToken(token);

      if (!payload) {
        const res = isPublicPath(pathname)
          ? NextResponse.next()
          : unauthenticatedResponse(req);

        res.cookies.delete("ld_token");
        return finalizeResponse(res, pathname);
      }

      const requestHeaders = new Headers(req.headers);
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
        );
      }

      const res = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      return finalizeResponse(res, pathname);
    } catch {
      const res = isPublicPath(pathname)
        ? NextResponse.next()
        : unauthenticatedResponse(req);

      res.cookies.delete("ld_token");
      return finalizeResponse(res, pathname);
    }
  }

  return finalizeResponse(NextResponse.next(), pathname);
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
