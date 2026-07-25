import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createDepartmentSchema,
  listDepartmentsQuerySchema,
} from "@/features/departments/schemas/department.schema";
import {
  createDepartment,
  listDepartmentsForViewer,
} from "@/features/departments/services/departments";

export async function GET(request: Request) {
  try {
    const user = await requireUser({ routeKey: "GET /api/departments" });
    await requirePermission(user, PERMISSIONS.DEPARTMENT_VIEW);

    const url = new URL(request.url);
    const parsed = listDepartmentsQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      managerId: url.searchParams.get("managerId") ?? undefined,
      includeArchived: url.searchParams.get("includeArchived") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      sortBy: url.searchParams.get("sortBy") ?? undefined,
      sortDir: url.searchParams.get("sortDir") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const result = await listDepartmentsForViewer(user, parsed.data);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser({ routeKey: "POST /api/departments" });
    await requirePermission(user, PERMISSIONS.DEPARTMENT_MANAGE);

    const body: unknown = await request.json();
    const parsed = createDepartmentSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const department = await createDepartment(parsed.data);
    return apiSuccess(department, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
