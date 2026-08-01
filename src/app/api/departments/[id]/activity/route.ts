import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { listEntityActivityQuerySchema } from "@/features/activity/schemas/activity.schema";
import { listEntityActivity } from "@/features/activity/services/entity-activity";
import { assertCanAccessDepartment } from "@/features/departments/services/assert-can-access-department";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/departments/[id]/activity",
    });
    await requirePermission(user, PERMISSIONS.DEPARTMENT_VIEW);

    const { id } = await context.params;
    await assertCanAccessDepartment(user, id);

    const url = new URL(request.url);
    const parsed = listEntityActivityQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const result = await listEntityActivity("department", id, parsed.data);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
