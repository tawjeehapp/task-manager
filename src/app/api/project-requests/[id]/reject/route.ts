import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { rejectProjectRequestSchema } from "@/features/project-requests/schemas/project-request.schema";
import { rejectProjectRequest } from "@/features/project-requests/services/project-requests";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/project-requests/[id]/reject",
    });
    await requirePermission(user, PERMISSIONS.PROJECT_REQUEST_APPROVE);
    const { id } = await context.params;
    const body = rejectProjectRequestSchema.parse(await request.json());
    const item = await rejectProjectRequest(user, id, body);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}
