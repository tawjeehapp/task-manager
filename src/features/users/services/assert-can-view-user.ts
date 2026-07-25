import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";

/**
 * M1 authorization for GET user by id.
 * Admin: any user. Employee / department_manager: own profile only.
 */
export function assertCanViewUser(viewer: AppUser, targetId: string): void {
  if (viewer.role === "admin") {
    return;
  }

  if (viewer.id === targetId) {
    return;
  }

  throw new ApiError("ليس لديك صلاحية لعرض هذا المستخدم.", 403, "FORBIDDEN");
}
