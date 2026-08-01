import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { getProjectRequestById } from "@/features/project-requests/services/project-requests";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/project-requests/[id]",
    });
    await requirePermission(user, PERMISSIONS.PROJECT_REQUEST_VIEW);
    const { id } = await context.params;
    const item = await getProjectRequestById(user, id);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}
