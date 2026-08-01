import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";

/** Project extension approval is admin-only; never self-approve. */
export function assertCanApproveProjectRequest(
  actor: AppUser,
  requesterId: string,
): void {
  if (actor.id === requesterId) {
    throw new ApiError(
      "لا يمكنك اعتماد أو رفض طلبك.",
      403,
      "CANNOT_APPROVE_OWN",
    );
  }

  if (actor.role === "admin") {
    return;
  }

  throw new ApiError(
    "اعتماد تمديد المشروع متاح للمسؤول فقط.",
    403,
    "FORBIDDEN",
  );
}

export function assertCanViewProjectRequest(
  viewer: AppUser,
  requesterId: string,
): void {
  if (viewer.role === "admin" || viewer.id === requesterId) {
    return;
  }

  throw new ApiError("ليس لديك صلاحية لعرض هذا الطلب.", 403, "FORBIDDEN");
}
