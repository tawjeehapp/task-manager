import "server-only";

import type {
  PushSubscribeInput,
  PushUnsubscribeInput,
} from "@/features/notifications/schemas/push.schema";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

export type PushSubscriptionRow = {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

export async function upsertPushSubscription(
  viewer: AppUser,
  input: PushSubscribeInput,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("push_subscriptions").upsert(
    {
      user_id: viewer.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      user_agent: input.userAgent ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) {
    throw error;
  }
}

export async function deletePushSubscription(
  viewer: AppUser,
  input: PushUnsubscribeInput,
): Promise<void> {
  const admin = createAdminClient();

  if (input.endpoint) {
    const { error } = await admin
      .from("push_subscriptions")
      .delete()
      .eq("user_id", viewer.id)
      .eq("endpoint", input.endpoint);
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("user_id", viewer.id);
  if (error) {
    throw error;
  }
}

export async function hasPushSubscription(viewer: AppUser): Promise<boolean> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.id);

  if (error) {
    throw error;
  }

  return (count ?? 0) > 0;
}

export async function listPushSubscriptionsForUsers(
  userIds: string[],
): Promise<PushSubscriptionRow[]> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    return [];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("push_subscriptions")
    .select("*")
    .in("user_id", uniqueIds);

  if (error) {
    console.error("[push] list subscriptions failed", error);
    return [];
  }

  return (data ?? []) as PushSubscriptionRow[];
}

export async function deletePushSubscriptionByEndpoint(
  endpoint: string,
): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", endpoint);

  if (error) {
    console.error("[push] prune subscription failed", error);
  }
}
