import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { ApiError } from "@/lib/api/errors";
import {
  pushSubscribeSchema,
  pushUnsubscribeSchema,
} from "@/features/notifications/schemas/push.schema";
import {
  deletePushSubscription,
  upsertPushSubscription,
} from "@/features/notifications/services/push-subscriptions";

export async function POST(request: Request) {
  try {
    const user = await requireUser({ routeKey: "POST /api/push/subscribe" });
    await requirePermission(user, PERMISSIONS.NOTIFICATION_VIEW);

    const body = pushSubscribeSchema.parse(await request.json());
    try {
      await upsertPushSubscription(user, body);
    } catch {
      throw new ApiError(
        "تعذر حفظ اشتراك الإشعارات.",
        500,
        "PUSH_SUBSCRIBE_FAILED",
      );
    }

    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await requireUser({ routeKey: "DELETE /api/push/subscribe" });
    await requirePermission(user, PERMISSIONS.NOTIFICATION_VIEW);

    let body: unknown = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const input = pushUnsubscribeSchema.parse(body);
    try {
      await deletePushSubscription(user, input);
    } catch {
      throw new ApiError(
        "تعذر إلغاء اشتراك الإشعارات.",
        500,
        "PUSH_UNSUBSCRIBE_FAILED",
      );
    }

    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
