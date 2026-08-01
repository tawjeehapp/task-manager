import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { markNotificationsReadSchema } from "@/features/notifications/schemas/notification.schema";
import { markNotificationsRead } from "@/features/notifications/services/notifications";

export async function POST(request: Request) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/notifications/mark-read",
    });
    await requirePermission(user, PERMISSIONS.NOTIFICATION_VIEW);

    const body = markNotificationsReadSchema.parse(await request.json());
    const result = await markNotificationsRead(user, body.ids);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
