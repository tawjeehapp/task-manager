import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { hasPermission, PERMISSIONS } from "@/lib/permissions";
import { getPermissionsForRole } from "@/lib/permissions/get-role-permissions";
import {
  createUserSchema,
  listUsersQuerySchema,
} from "@/features/users/schemas/user.schema";
import { createUser } from "@/features/users/services/create-user";
import { listUsersForViewer } from "@/features/users/services/get-users";

export async function GET(request: Request) {
  try {
    const user = await requireUser({ routeKey: "GET /api/users" });
    const granted = await getPermissionsForRole(user.role);
    const canManage = hasPermission(
      user.role,
      PERMISSIONS.USER_MANAGE,
      granted,
    );
    const canReset = hasPermission(
      user.role,
      PERMISSIONS.USER_RESET_PASSWORD,
      granted,
    );

    if (!canManage && !canReset) {
      throw new ApiError("ليس لديك صلاحية لتنفيذ هذا الإجراء.", 403, "FORBIDDEN");
    }

    const url = new URL(request.url);
    const parsed = listUsersQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      role: url.searchParams.get("role") ?? undefined,
      isActive: url.searchParams.get("isActive") ?? undefined,
      departmentId: url.searchParams.get("departmentId") ?? undefined,
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

    // Only admins (user.manage) may filter by arbitrary departmentId / role
    const query = {
      ...parsed.data,
      departmentId: canManage ? parsed.data.departmentId : undefined,
      role: canManage ? parsed.data.role : undefined,
    };

    const result = await listUsersForViewer(user, query, canManage);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser({ routeKey: "POST /api/users" });
    await requirePermission(user, PERMISSIONS.USER_MANAGE);

    const body: unknown = await request.json();
    const parsed = createUserSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const created = await createUser(parsed.data);
    return apiSuccess(created, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
