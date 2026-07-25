import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { getEmployeeWorkload } from "@/features/tasks/services/workload";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/users/[id]/workload",
    });
    await requirePermission(user, PERMISSIONS.TASK_ASSIGN);

    const { id } = await context.params;
    const workload = await getEmployeeWorkload(user, id);
    return apiSuccess(workload);
  } catch (error) {
    return apiError(error);
  }
}
