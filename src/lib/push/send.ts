import "server-only";

import webpush from "web-push";

import {
  deletePushSubscriptionByEndpoint,
  listPushSubscriptionsForUsers,
} from "@/features/notifications/services/push-subscriptions";
import { getServerEnv } from "@/config/env";

export type WebPushPayload = {
  title: string;
  message: string;
  url: string;
};

function configureVapid(): boolean {
  const env = getServerEnv();
  if (!env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return false;
  }

  webpush.setVapidDetails(
    env.VAPID_SUBJECT || "mailto:admin@localhost",
    env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
  return true;
}

function isGoneStatus(statusCode: number | undefined): boolean {
  return statusCode === 404 || statusCode === 410;
}

/**
 * Best-effort Web Push delivery. Never throws.
 */
export async function sendWebPushToUsers(
  userIds: string[],
  payload: WebPushPayload,
): Promise<void> {
  try {
    if (!configureVapid()) {
      return;
    }

    const subscriptions = await listPushSubscriptionsForUsers(userIds);
    if (subscriptions.length === 0) {
      return;
    }

    const body = JSON.stringify({
      title: payload.title,
      body: payload.message,
      url: payload.url,
    });

    await Promise.all(
      subscriptions.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            body,
            { TTL: 60 * 60 * 12 },
          );
        } catch (error) {
          const statusCode =
            error &&
            typeof error === "object" &&
            "statusCode" in error &&
            typeof (error as { statusCode?: unknown }).statusCode === "number"
              ? (error as { statusCode: number }).statusCode
              : undefined;

          if (isGoneStatus(statusCode)) {
            await deletePushSubscriptionByEndpoint(sub.endpoint);
            return;
          }

          console.error("[push] send failed", {
            endpoint: sub.endpoint,
            statusCode,
            error,
          });
        }
      }),
    );
  } catch (error) {
    console.error("[push] sendWebPushToUsers failed", error);
  }
}
