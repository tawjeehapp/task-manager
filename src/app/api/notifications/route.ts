import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { listNotificationsQuerySchema } from "@/features/notifications/schemas/notification.schema";
import { listNotifications } from "@/features/notifications/services/notifications";

export async function GET(request: Request) {
  try {
    const user = await requireUser({ routeKey: "GET /api/notifications" });
    await requirePermission(user, PERMISSIONS.NOTIFICATION_VIEW);

    const url = new URL(request.url);
    const query = listNotificationsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const result = await listNotifications(user, query);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
