import "server-only";

import { sharesManagedDepartmentWith } from "@/features/departments/services/membership-helpers";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";

/**
 * Admin: any record except own.
 * Department manager: current members of managed department (not self).
 */
export async function assertCanApproveAttendance(
  actor: AppUser,
  targetUserId: string,
): Promise<void> {
  if (actor.id === targetUserId) {
    throw new ApiError(
      "لا يمكنك اعتماد أو رفض سجل حضورك.",
      403,
      "CANNOT_APPROVE_OWN",
    );
  }

  if (actor.role === "admin") {
    return;
  }

  if (actor.role === "department_manager") {
    const shares = await sharesManagedDepartmentWith(actor.id, targetUserId);
    if (shares) {
      return;
    }
  }

  throw new ApiError(
    "ليس لديك صلاحية اعتماد هذا السجل.",
    403,
    "FORBIDDEN",
  );
}

/** Viewer may see own records, admin all, manager department members. */
export async function assertCanViewAttendanceUser(
  viewer: AppUser,
  targetUserId: string,
): Promise<void> {
  if (viewer.role === "admin" || viewer.id === targetUserId) {
    return;
  }

  if (viewer.role === "department_manager") {
    const shares = await sharesManagedDepartmentWith(viewer.id, targetUserId);
    if (shares) {
      return;
    }
  }

  throw new ApiError("ليس لديك صلاحية لعرض هذا السجل.", 403, "FORBIDDEN");
}
