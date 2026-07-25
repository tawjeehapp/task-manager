import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createUserSchema,
  listUsersQuerySchema,
} from "@/features/users/schemas/user.schema";
import { createUser } from "@/features/users/services/create-user";
import { listUsers } from "@/features/users/services/get-users";

export async function GET(request: Request) {
  try {
    const user = await requireUser({ routeKey: "GET /api/users" });
    await requirePermission(user, PERMISSIONS.USER_MANAGE);

    const url = new URL(request.url);
    const parsed = listUsersQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      isActive: url.searchParams.get("isActive") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const result = await listUsers(parsed.data);
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
