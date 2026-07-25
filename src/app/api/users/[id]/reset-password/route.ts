import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { assertCanResetPassword } from "@/features/users/services/assert-can-reset-password";
import { resetUserPassword } from "@/features/users/services/reset-password";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/users/[id]/reset-password",
    });
    await requirePermission(user, PERMISSIONS.USER_RESET_PASSWORD);

    const { id } = await context.params;
    await assertCanResetPassword(user, id);
    await resetUserPassword(id);
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
