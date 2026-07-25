import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { updateUserSchema } from "@/features/users/schemas/user.schema";
import { getUserById } from "@/features/users/services/get-user";
import { updateUser } from "@/features/users/services/update-user";
import { deleteUser } from "@/features/users/services/delete-user";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "GET /api/users/[id]" });
    const { id } = await context.params;
    const profile = await getUserById(user, id);
    return apiSuccess(profile);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "PATCH /api/users/[id]" });
    await requirePermission(user, PERMISSIONS.USER_MANAGE);

    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = updateUserSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const updated = await updateUser(user, id, parsed.data);
    return apiSuccess(updated);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "DELETE /api/users/[id]" });
    await requirePermission(user, PERMISSIONS.USER_MANAGE);

    const { id } = await context.params;
    await deleteUser(user, id);
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
