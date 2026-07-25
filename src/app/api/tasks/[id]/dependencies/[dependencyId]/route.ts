import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { removeTaskDependency } from "@/features/tasks/services/dependencies";

type RouteContext = {
  params: Promise<{ id: string; dependencyId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "DELETE /api/tasks/[id]/dependencies/[dependencyId]",
    });
    const { id, dependencyId } = await context.params;
    await removeTaskDependency(user, id, dependencyId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
