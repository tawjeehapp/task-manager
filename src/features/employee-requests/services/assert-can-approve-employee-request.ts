import "server-only";

import { sharesManagedDepartmentWith } from "@/features/departments/services/membership-helpers";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";

export async function assertCanApproveEmployeeRequest(
  actor: AppUser,
  targetUserId: string,
): Promise<void> {
  if (actor.id === targetUserId) {
    throw new ApiError(
      "لا يمكنك اعتماد أو رفض طلبك.",
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
    "ليس لديك صلاحية اعتماد هذا الطلب.",
    403,
    "FORBIDDEN",
  );
}

export async function assertCanViewEmployeeRequestUser(
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

  throw new ApiError("ليس لديك صلاحية لعرض هذا الطلب.", 403, "FORBIDDEN");
}
