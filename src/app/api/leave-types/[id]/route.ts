import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { updateLeaveTypeSchema } from "@/features/leave/schemas/leave.schema";
import {
  deactivateLeaveType,
  updateLeaveType,
} from "@/features/leave/services/leave-types-balances";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "PATCH /api/leave-types/[id]" });
    await requirePermission(user, PERMISSIONS.LEAVE_MANAGE);
    const { id } = await context.params;
    const body = updateLeaveTypeSchema.parse(await request.json());
    const item = await updateLeaveType(id, body);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}

/** Soft-deactivate (is_active = false). Does not physically delete. */
export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "DELETE /api/leave-types/[id]" });
    await requirePermission(user, PERMISSIONS.LEAVE_MANAGE);
    const { id } = await context.params;
    const item = await deactivateLeaveType(id);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}
