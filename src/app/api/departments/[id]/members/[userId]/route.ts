import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { tryLogEntityActivity } from "@/features/activity/services/entity-activity";
import { removeDepartmentMember } from "@/features/departments/services/memberships";

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "DELETE /api/departments/[id]/members/[userId]",
    });
    await requirePermission(user, PERMISSIONS.DEPARTMENT_MANAGE);

    const { id, userId } = await context.params;
    await removeDepartmentMember(id, userId);
    await tryLogEntityActivity(
      user.id,
      "department",
      id,
      "department.member_removed",
      { userId },
    );
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
