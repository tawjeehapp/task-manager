import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { markAllNotificationsRead } from "@/features/notifications/services/notifications";

export async function POST() {
  try {
    const user = await requireUser({
      routeKey: "POST /api/notifications/read-all",
    });
    await requirePermission(user, PERMISSIONS.NOTIFICATION_VIEW);
    const result = await markAllNotificationsRead(user);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
