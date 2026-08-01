import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { tryLogEntityActivity } from "@/features/activity/services/entity-activity";
import { updateDepartmentSchema } from "@/features/departments/schemas/department.schema";
import {
  deleteDepartment,
  getDepartmentForViewer,
  updateDepartment,
} from "@/features/departments/services/departments";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "GET /api/departments/[id]" });
    await requirePermission(user, PERMISSIONS.DEPARTMENT_VIEW);

    const { id } = await context.params;
    const department = await getDepartmentForViewer(user, id);
    return apiSuccess(department);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "PATCH /api/departments/[id]" });
    await requirePermission(user, PERMISSIONS.DEPARTMENT_MANAGE);

    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = updateDepartmentSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const department = await updateDepartment(id, parsed.data);
    await tryLogEntityActivity(
      user.id,
      "department",
      id,
      "department.updated",
      {
        fields: Object.keys(parsed.data).filter(
          (key) => parsed.data[key as keyof typeof parsed.data] !== undefined,
        ),
      },
    );
    return apiSuccess(department);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "DELETE /api/departments/[id]",
    });
    await requirePermission(user, PERMISSIONS.DEPARTMENT_MANAGE);

    const { id } = await context.params;
    await deleteDepartment(id);
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
