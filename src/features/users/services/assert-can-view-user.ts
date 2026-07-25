import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { sharesManagedDepartmentWith } from "@/features/departments/services/membership-helpers";

/**
 * Authorization for viewing a user profile.
 * Admin: any. Self: always. Department manager: subordinates in managed department.
 */
export async function assertCanViewUser(
  viewer: AppUser,
  targetId: string,
): Promise<void> {
  if (viewer.role === "admin") {
    return;
  }

  if (viewer.id === targetId) {
    return;
  }

  if (viewer.role === "department_manager") {
    const shares = await sharesManagedDepartmentWith(viewer.id, targetId);
    if (shares) {
      return;
    }
  }

  throw new ApiError("ليس لديك صلاحية لعرض هذا المستخدم.", 403, "FORBIDDEN");
}
