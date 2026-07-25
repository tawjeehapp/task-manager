import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { getUnreadNotificationCount } from "@/features/notifications/services/notifications";

export async function GET() {
  try {
    const user = await requireUser({
      routeKey: "GET /api/notifications/unread-count",
    });
    await requirePermission(user, PERMISSIONS.NOTIFICATION_VIEW);
    const count = await getUnreadNotificationCount(user);
    return apiSuccess({ count });
  } catch (error) {
    return apiError(error);
  }
}
