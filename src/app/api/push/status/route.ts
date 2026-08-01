import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/api/errors";
import { hasPushSubscription } from "@/features/notifications/services/push-subscriptions";

export async function GET() {
  try {
    const user = await requireUser({ routeKey: "GET /api/push/status" });
    await requirePermission(user, PERMISSIONS.NOTIFICATION_VIEW);

    let subscribed = false;
    try {
      subscribed = await hasPushSubscription(user);
    } catch {
      throw new ApiError(
        "تعذر التحقق من اشتراك الإشعارات.",
        500,
        "PUSH_STATUS_FAILED",
      );
    }

    return apiSuccess({ subscribed });
  } catch (error) {
    return apiError(error);
  }
}
