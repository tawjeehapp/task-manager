import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { updateProjectSchema } from "@/features/projects/schemas/project.schema";
import {
  getProjectForViewer,
  updateProject,
} from "@/features/projects/services/projects";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "GET /api/projects/[id]" });
    await requirePermission(user, PERMISSIONS.PROJECT_VIEW);

    const { id } = await context.params;
    const project = await getProjectForViewer(user, id);
    return apiSuccess(project);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "PATCH /api/projects/[id]" });
    await requirePermission(user, PERMISSIONS.PROJECT_MANAGE);

    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = updateProjectSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const project = await updateProject(user, id, parsed.data);
    return apiSuccess(project);
  } catch (error) {
    return apiError(error);
  }
}
