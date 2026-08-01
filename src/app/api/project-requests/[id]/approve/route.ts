import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { approveProjectRequest } from "@/features/project-requests/services/project-requests";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/project-requests/[id]/approve",
    });
    await requirePermission(user, PERMISSIONS.PROJECT_REQUEST_APPROVE);
    const { id } = await context.params;
    const item = await approveProjectRequest(user, id);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}
