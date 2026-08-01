import "server-only";

import type {
  CreateNotificationInput,
  Notification,
  NotificationEntityType,
  NotificationType,
} from "@/features/notifications/types/notification.types";
import type { ListNotificationsQuery } from "@/features/notifications/schemas/notification.schema";
import { notificationHref } from "@/features/notifications/lib/notification-href";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { sendWebPushToUsers } from "@/lib/push/send";
import { createAdminClient } from "@/lib/supabase/admin";

type NotificationRow = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  entity_type: NotificationEntityType | null;
  entity_id: string | null;
  read_at: string | null;
  created_at: string;
};

function mapNotificationRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    message: row.message,
    entityType: row.entity_type,
    entityId: row.entity_id,
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

function pushUrlFor(
  input: Pick<CreateNotificationInput, "entityType" | "entityId">,
): string {
  return (
    notificationHref(input.entityType ?? null, input.entityId ?? null) ??
    "/notifications"
  );
}

async function dispatchWebPush(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">,
): Promise<void> {
  await sendWebPushToUsers(userIds, {
    title: input.title,
    message: input.message,
    url: pushUrlFor(input),
  });
}

export async function createNotification(
  input: CreateNotificationInput,
): Promise<Notification | null> {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("notifications")
      .insert({
        user_id: input.userId,
        type: input.type,
        title: input.title,
        message: input.message,
        entity_type: input.entityType ?? null,
        entity_id: input.entityId ?? null,
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("[notifications] create failed", error);
      return null;
    }

    await dispatchWebPush([input.userId], input);
    return mapNotificationRow(data as NotificationRow);
  } catch (error) {
    console.error("[notifications] create failed", error);
    return null;
  }
}

export async function createNotificationsForUsers(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">,
): Promise<void> {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  if (uniqueIds.length === 0) {
    return;
  }

  try {
    const admin = createAdminClient();
    const rows = uniqueIds.map((userId) => ({
      user_id: userId,
      type: input.type,
      title: input.title,
      message: input.message,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
    }));

    const { error } = await admin.from("notifications").insert(rows);
    if (error) {
      console.error("[notifications] bulk create failed", error);
      return;
    }

    await dispatchWebPush(uniqueIds, input);
  } catch (error) {
    console.error("[notifications] bulk create failed", error);
  }
}

/**
 * Best-effort notify. Never throws — primary business actions must succeed.
 */
export async function notifySafe(
  userIds: string | string[],
  input: Omit<CreateNotificationInput, "userId">,
): Promise<void> {
  const ids = Array.isArray(userIds) ? userIds : [userIds];
  await createNotificationsForUsers(ids, input);
}

export async function listNotifications(
  viewer: AppUser,
  query: ListNotificationsQuery,
): Promise<{
  items: Notification[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const admin = createAdminClient();
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  let q = admin
    .from("notifications")
    .select("*", { count: "exact" })
    .eq("user_id", viewer.id)
    .order("created_at", { ascending: false });

  if (query.unreadOnly) {
    q = q.is("read_at", null);
  }

  const { data, error, count } = await q.range(from, to);

  if (error) {
    throw new ApiError(
      "تعذر تحميل الإشعارات.",
      500,
      "LIST_NOTIFICATIONS_FAILED",
    );
  }

  const total = count ?? 0;
  return {
    items: ((data ?? []) as NotificationRow[]).map(mapNotificationRow),
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
  };
}

export async function getUnreadNotificationCount(
  viewer: AppUser,
): Promise<number> {
  const admin = createAdminClient();
  const { count, error } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", viewer.id)
    .is("read_at", null);

  if (error) {
    throw new ApiError(
      "تعذر تحميل عدد الإشعارات.",
      500,
      "UNREAD_COUNT_FAILED",
    );
  }

  return count ?? 0;
}

export async function markNotificationRead(
  viewer: AppUser,
  id: string,
): Promise<Notification> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("notifications")
    .update({ read_at: now })
    .eq("id", id)
    .eq("user_id", viewer.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new ApiError(
      "تعذر تحديث الإشعار.",
      500,
      "MARK_NOTIFICATION_READ_FAILED",
    );
  }
  if (!data) {
    throw new ApiError("الإشعار غير موجود.", 404, "NOTIFICATION_NOT_FOUND");
  }

  return mapNotificationRow(data as NotificationRow);
}

export async function markAllNotificationsRead(
  viewer: AppUser,
): Promise<{ updated: number }> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("notifications")
    .update({ read_at: now })
    .eq("user_id", viewer.id)
    .is("read_at", null)
    .select("id");

  if (error) {
    throw new ApiError(
      "تعذر تحديث الإشعارات.",
      500,
      "MARK_ALL_READ_FAILED",
    );
  }

  return { updated: data?.length ?? 0 };
}

export async function markNotificationsRead(
  viewer: AppUser,
  ids: string[],
): Promise<{ updated: number }> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return { updated: 0 };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await admin
    .from("notifications")
    .update({ read_at: now })
    .eq("user_id", viewer.id)
    .in("id", uniqueIds)
    .is("read_at", null)
    .select("id");

  if (error) {
    throw new ApiError(
      "تعذر تحديث الإشعارات.",
      500,
      "MARK_NOTIFICATIONS_READ_FAILED",
    );
  }

  return { updated: data?.length ?? 0 };
}

/** @deprecated Use named exports — kept for gradual stub migration */
export const notificationService = {
  list: async () => {
    throw new Error("Use listNotifications(viewer, query) instead.");
  },
  create: createNotification,
  markRead: async () => {
    throw new Error("Use markNotificationRead(viewer, id) instead.");
  },
};
