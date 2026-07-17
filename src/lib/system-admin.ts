import { getSession } from "@/lib/auth";
import { validateSessionPayload } from "@/lib/api-auth";

export async function requireSystemAdmin() {
  const tokenUser = await getSession();

  if (!tokenUser) {
    throw new Error("Unauthorized");
  }

  const validation = await validateSessionPayload(tokenUser);

  if (!validation.ok) {
    throw new Error("Unauthorized");
  }

  if (!validation.user.isSystemAdmin) {
    throw new Error("Forbidden");
  }

  return {
    id: validation.user.userId,
    name: validation.user.name,
    email: validation.user.email,
    role: validation.user.role,
    isSystemAdmin: validation.user.isSystemAdmin,
  };
}
