import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { removeProjectMember } from "@/features/projects/services/members";

type RouteContext = {
  params: Promise<{ id: string; userId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "DELETE /api/projects/[id]/members/[userId]",
    });
    await requirePermission(user, PERMISSIONS.PROJECT_VIEW);

    const { id, userId } = await context.params;
    await removeProjectMember(user, id, userId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
