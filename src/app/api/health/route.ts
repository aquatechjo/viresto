import { Redis } from "@upstash/redis";
import { NextRequest, NextResponse } from "next/server";
import { getHealthServiceConfiguration, isHealthCheckAuthorized } from "@/lib/health-check";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

type CheckStatus = "ok" | "configured" | "optional" | "misconfigured" | "unavailable";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  Pragma: "no-cache",
  Vary: "Authorization",
};

let reportedMissingSecret = false;

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

function errorName(error: unknown) {
  return error instanceof Error ? error.name : "UnknownError";
}

export async function GET(req: NextRequest) {
  const healthSecret = process.env.HEALTHCHECK_SECRET;

  if (!healthSecret?.trim()) {
    if (!reportedMissingSecret) {
      reportedMissingSecret = true;
      console.error("[HEALTHCHECK_MISCONFIGURED] HEALTHCHECK_SECRET is missing.");
    }
    return response({ ok: false, status: "unavailable" }, 401);
  }

  if (!isHealthCheckAuthorized(req.headers.get("authorization"), healthSecret)) {
    return response({ ok: false, status: "unauthorized" }, 401);
  }

  const configured = getHealthServiceConfiguration(process.env);
  const checks: Record<string, { status: CheckStatus; mode: "live" | "configuration" }> = {
    app: { status: "ok", mode: "live" },
    database: { status: "unavailable", mode: "live" },
    redis: {
      status: configured.redis ? "unavailable" : "misconfigured",
      mode: "live",
    },
    cloudinary: {
      status: configured.cloudinary ? "configured" : "misconfigured",
      mode: "configuration",
    },
    email: {
      status: configured.email ? "configured" : "misconfigured",
      mode: "configuration",
    },
    ai: {
      status: configured.ai ? "configured" : "optional",
      mode: "configuration",
    },
  };

  const [databaseResult, redisResult] = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    configured.redis ? Redis.fromEnv().ping() : Promise.reject(new Error("RedisMisconfigured")),
  ]);

  if (databaseResult.status === "fulfilled") {
    checks.database.status = "ok";
  } else {
    console.error(`[HEALTHCHECK_DATABASE_ERROR] ${errorName(databaseResult.reason)}`);
  }

  if (redisResult.status === "fulfilled") {
    checks.redis.status = "ok";
  } else if (configured.redis) {
    console.error(`[HEALTHCHECK_REDIS_ERROR] ${errorName(redisResult.reason)}`);
  }

  const ready = ["database", "redis", "cloudinary", "email"].every((name) =>
    ["ok", "configured"].includes(checks[name].status),
  );

  return response(
    {
      ok: ready,
      status: ready ? "ready" : "degraded",
      checkedAt: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || "local",
      checks,
    },
    ready ? 200 : 503,
  );
}
