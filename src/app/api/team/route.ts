import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ok, err } from "@/lib/api-response";
import { requireRole } from "@/lib/api-auth";
import { apiHandler } from "@/lib/api-handler";
import { assertTenantCanCreate } from "@/lib/billing-limits";
import { verifySameOrigin } from "@/lib/csrf";

const allowedRoles = ["ADMIN", "LAWYER", "STAFF"] as const;

export async function GET(req: NextRequest) {
  return apiHandler(async () => {
    const mode = new URL(req.url).searchParams.get("mode");
    const auth = await requireRole(
      req,
      mode === "assignees"
        ? ["ADMIN", "LAWYER", "STAFF"]
        : ["ADMIN"],
    );
    if (auth.error || !auth.user) return auth.error;

    if (mode === "assignees") {
      const members = await prisma.user.findMany({
        where: {
          tenantId: auth.user.tenantId,
          isActive: true,
        },
        orderBy: [
          { isSystemAdmin: "desc" },
          { role: "asc" },
          { name: "asc" },
        ],
        select: {
          id: true,
          name: true,
          role: true,
          isSystemAdmin: true,
        },
      });

      return ok({
        currentUserId: auth.user.userId,
        currentRole: auth.user.role,
        members,
      });
    }

    const users = await prisma.user.findMany({
      where: {
        tenantId: auth.user.tenantId,
      },
      orderBy: [{ isSystemAdmin: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isSystemAdmin: true,
        createdAt: true,
      },
    });

    return ok({
      currentRole: auth.user.role,
      users,
    });
  });
}

export async function POST(req: NextRequest) {
  return apiHandler(async () => {
    const csrf = verifySameOrigin(req);
    if (csrf) return csrf;

    const auth = await requireRole(req, ["ADMIN"]);
    if (auth.error || !auth.user) return auth.error;

    const limitCheck = await assertTenantCanCreate(auth.user.tenantId, "users");

    if (!limitCheck.ok) {
      const isPlanLimit = limitCheck.billing?.canCreate === true;

      return err(limitCheck.message, isPlanLimit ? 400 : 402, {
        code: isPlanLimit ? "PLAN_LIMIT_REACHED" : "SUBSCRIPTION_INACTIVE",
        resource: "users",
        billing: limitCheck.billing ?? null,
      });
    }

    const body = await req.json().catch(() => ({}));

    const name = String(body.name ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role ?? "").trim().toUpperCase();
    const password = String(body.password ?? "");

    if (!name || !email || !role || !password) {
      return err("جميع الحقول مطلوبة", 400);
    }

    if (name.length < 2 || name.length > 100) {
      return err("اسم المستخدم غير صالح", 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return err("البريد الإلكتروني غير صالح", 400);
    }

    if (email.length > 160) {
      return err("البريد الإلكتروني طويل جدًا", 400);
    }

    if (password.length < 8) {
      return err("كلمة المرور يجب أن تكون 8 أحرف على الأقل", 400);
    }

    if (password.length > 72) {
      return err("كلمة المرور طويلة جدًا", 400);
    }

    if (!allowedRoles.includes(role as (typeof allowedRoles)[number])) {
      return err("صلاحية غير صحيحة", 400);
    }

    const existing = await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
      },
    });

    if (existing) {
      return err("البريد الإلكتروني مستخدم مسبقًا", 409);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        tenantId: auth.user.tenantId,
        name,
        email,
        role: role as (typeof allowedRoles)[number],
        passwordHash,
        isActive: true,
        isSystemAdmin: false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        isSystemAdmin: true,
        createdAt: true,
      },
    });

    return ok(user, 201);
  });
}