import "server-only";

import type {
  CreateAnnouncementInput,
  ListAnnouncementsQuery,
  UpdateAnnouncementInput,
} from "@/features/announcements/schemas/announcement.schema";
import type {
  Announcement,
  AnnouncementAudienceType,
  AnnouncementPriority,
} from "@/features/announcements/types/announcement.types";
import {
  getManagedDepartmentId,
} from "@/features/departments/services/membership-helpers";
import {
  listActiveUserIds,
  listDepartmentMemberUserIds,
} from "@/features/notifications/services/recipients";
import { notifySafe } from "@/features/notifications/services/notifications";
import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { createAdminClient } from "@/lib/supabase/admin";

type AnnouncementRow = {
  id: string;
  title: string;
  content: string;
  audience_type: AnnouncementAudienceType;
  department_id: string | null;
  priority: AnnouncementPriority;
  publish_at: string;
  expires_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  department?: { id: string; name: string } | null;
  created_by_user?: { id: string; full_name: string } | null;
};

const ANNOUNCEMENT_SELECT =
  "id, title, content, audience_type, department_id, priority, publish_at, expires_at, created_by, created_at, updated_at, department:departments!department_id(id, name), created_by_user:users!created_by(id, full_name)";

function isAnnouncementActive(
  publishAt: string,
  expiresAt: string | null,
  now = new Date(),
): boolean {
  const published = new Date(publishAt) <= now;
  const notExpired = !expiresAt || new Date(expiresAt) > now;
  return published && notExpired;
}

function mapAnnouncementRow(
  row: AnnouncementRow,
  isRead: boolean,
): Announcement {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    audienceType: row.audience_type,
    departmentId: row.department_id,
    departmentName: row.department?.name ?? null,
    priority: row.priority,
    publishAt: row.publish_at,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    createdByName: row.created_by_user?.full_name ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isRead,
    isActive: isAnnouncementActive(row.publish_at, row.expires_at),
  };
}

async function assertCanManageAnnouncement(
  actor: AppUser,
  audienceType: AnnouncementAudienceType,
  departmentId: string | null,
): Promise<void> {
  if (actor.role === "admin") {
    return;
  }

  if (actor.role !== "department_manager") {
    throw new ApiError("ليس لديك صلاحية إدارة الإعلانات.", 403, "FORBIDDEN");
  }

  if (audienceType !== "department" || !departmentId) {
    throw new ApiError(
      "يمكن لمدير القسم نشر إعلانات القسم فقط.",
      403,
      "FORBIDDEN",
    );
  }

  const managedId = await getManagedDepartmentId(actor.id);
  if (managedId !== departmentId) {
    throw new ApiError(
      "يمكنك إدارة إعلانات قسمك فقط.",
      403,
      "FORBIDDEN",
    );
  }
}

async function assertCanViewAnnouncement(
  viewer: AppUser,
  row: AnnouncementRow,
): Promise<void> {
  if (viewer.role === "admin" || row.created_by === viewer.id) {
    return;
  }

  const now = new Date();
  if (new Date(row.publish_at) > now) {
    throw new ApiError("الإعلان غير موجود.", 404, "ANNOUNCEMENT_NOT_FOUND");
  }

  if (row.audience_type === "company") {
    return;
  }

  if (!row.department_id) {
    throw new ApiError("الإعلان غير موجود.", 404, "ANNOUNCEMENT_NOT_FOUND");
  }

  const admin = createAdminClient();
  const { data: membership } = await admin
    .from("department_memberships")
    .select("id")
    .eq("department_id", row.department_id)
    .eq("user_id", viewer.id)
    .eq("is_current", true)
    .maybeSingle();

  if (!membership) {
    throw new ApiError("الإعلان غير موجود.", 404, "ANNOUNCEMENT_NOT_FOUND");
  }
}

async function loadReadSet(
  userId: string,
  announcementIds: string[],
): Promise<Set<string>> {
  if (announcementIds.length === 0) {
    return new Set();
  }
  const admin = createAdminClient();
  const { data } = await admin
    .from("announcement_reads")
    .select("announcement_id")
    .eq("user_id", userId)
    .in("announcement_id", announcementIds);

  return new Set((data ?? []).map((row) => row.announcement_id as string));
}

async function getAnnouncementRow(id: string): Promise<AnnouncementRow> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .select(ANNOUNCEMENT_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error || !data) {
    throw new ApiError("الإعلان غير موجود.", 404, "ANNOUNCEMENT_NOT_FOUND");
  }

  return data as unknown as AnnouncementRow;
}

export async function getAnnouncementById(
  viewer: AppUser,
  id: string,
): Promise<Announcement> {
  const row = await getAnnouncementRow(id);
  await assertCanViewAnnouncement(viewer, row);
  const readSet = await loadReadSet(viewer.id, [id]);
  return mapAnnouncementRow(row, readSet.has(id));
}

export async function listAnnouncements(
  viewer: AppUser,
  query: ListAnnouncementsQuery,
): Promise<{
  items: Announcement[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize - 1;

  let q = admin
    .from("announcements")
    .select(ANNOUNCEMENT_SELECT, { count: "exact" })
    .order("publish_at", { ascending: false });

  if (viewer.role !== "admin") {
    const { data: memberships } = await admin
      .from("department_memberships")
      .select("department_id")
      .eq("user_id", viewer.id)
      .eq("is_current", true);

    const memberDeptIds = (memberships ?? []).map(
      (m) => m.department_id as string,
    );

    const visibilityParts = [
      "audience_type.eq.company",
      `created_by.eq.${viewer.id}`,
    ];
    if (memberDeptIds.length > 0) {
      visibilityParts.push(`department_id.in.(${memberDeptIds.join(",")})`);
    }
    q = q.or(visibilityParts.join(",")).lte("publish_at", nowIso);
  }

  if (query.audienceType) {
    q = q.eq("audience_type", query.audienceType);
  }
  if (query.priority) {
    q = q.eq("priority", query.priority);
  }

  if (query.status === "active") {
    q = q.lte("publish_at", nowIso);
  } else if (query.status === "expired") {
    q = q.not("expires_at", "is", null).lte("expires_at", nowIso);
  }

  const { data, error, count } = await q.range(from, to);

  if (error) {
    throw new ApiError(
      "تعذر تحميل الإعلانات.",
      500,
      "LIST_ANNOUNCEMENTS_FAILED",
    );
  }

  const rows = (data ?? []) as unknown as AnnouncementRow[];
  const readSet = await loadReadSet(
    viewer.id,
    rows.map((r) => r.id),
  );

  let items = rows.map((row) => mapAnnouncementRow(row, readSet.has(row.id)));

  if (query.status === "active") {
    items = items.filter((item) => item.isActive);
  }
  if (query.unreadOnly) {
    items = items.filter((item) => !item.isRead);
  }

  const total =
    query.unreadOnly || query.status === "active"
      ? items.length
      : (count ?? 0);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
  };
}

export async function createAnnouncement(
  actor: AppUser,
  input: CreateAnnouncementInput,
): Promise<Announcement> {
  const departmentId =
    input.audienceType === "department" ? (input.departmentId ?? null) : null;

  await assertCanManageAnnouncement(actor, input.audienceType, departmentId);

  if (departmentId) {
    const admin = createAdminClient();
    const { data: dept } = await admin
      .from("departments")
      .select("id")
      .eq("id", departmentId)
      .maybeSingle();
    if (!dept) {
      throw new ApiError("القسم غير موجود.", 404, "DEPARTMENT_NOT_FOUND");
    }
  }

  const publishAt = input.publishAt ?? new Date().toISOString();
  const expiresAt = input.expiresAt ?? null;

  if (expiresAt && expiresAt <= publishAt) {
    throw new ApiError(
      "تاريخ الانتهاء يجب أن يكون بعد تاريخ النشر.",
      400,
      "INVALID_EXPIRY",
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("announcements")
    .insert({
      title: input.title,
      content: input.content,
      audience_type: input.audienceType,
      department_id: departmentId,
      priority: input.priority,
      publish_at: publishAt,
      expires_at: expiresAt,
      created_by: actor.id,
    })
    .select(ANNOUNCEMENT_SELECT)
    .single();

  if (error || !data) {
    throw new ApiError(
      "تعذر إنشاء الإعلان.",
      500,
      "CREATE_ANNOUNCEMENT_FAILED",
    );
  }

  const row = data as unknown as AnnouncementRow;

  // Notify audience when already published
  if (new Date(publishAt) <= new Date()) {
    const recipientIds =
      input.audienceType === "company"
        ? await listActiveUserIds(actor.id)
        : (await listDepartmentMemberUserIds(departmentId!)).filter(
            (id) => id !== actor.id,
          );

    await notifySafe(recipientIds, {
      type: "announcement",
      title: "إعلان جديد",
      message: input.title,
      entityType: "announcement",
      entityId: row.id,
    });
  }

  return mapAnnouncementRow(row, true);
}

export async function updateAnnouncement(
  actor: AppUser,
  id: string,
  input: UpdateAnnouncementInput,
): Promise<Announcement> {
  const existing = await getAnnouncementRow(id);
  await assertCanManageAnnouncement(
    actor,
    existing.audience_type,
    existing.department_id,
  );

  const publishAt = input.publishAt ?? existing.publish_at;
  const expiresAt =
    input.expiresAt !== undefined ? input.expiresAt : existing.expires_at;

  if (expiresAt && expiresAt <= publishAt) {
    throw new ApiError(
      "تاريخ الانتهاء يجب أن يكون بعد تاريخ النشر.",
      400,
      "INVALID_EXPIRY",
    );
  }

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.content !== undefined) patch.content = input.content;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.publishAt !== undefined) patch.publish_at = input.publishAt;
  if (input.expiresAt !== undefined) patch.expires_at = input.expiresAt;

  const admin = createAdminClient();
  const { error } = await admin
    .from("announcements")
    .update(patch)
    .eq("id", id);

  if (error) {
    throw new ApiError(
      "تعذر تحديث الإعلان.",
      500,
      "UPDATE_ANNOUNCEMENT_FAILED",
    );
  }

  return getAnnouncementById(actor, id);
}

/** Soft-unpublish: set expires_at to now. */
export async function expireAnnouncement(
  actor: AppUser,
  id: string,
): Promise<Announcement> {
  const existing = await getAnnouncementRow(id);
  await assertCanManageAnnouncement(
    actor,
    existing.audience_type,
    existing.department_id,
  );

  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("announcements")
    .update({ expires_at: now })
    .eq("id", id);

  if (error) {
    throw new ApiError(
      "تعذر إنهاء الإعلان.",
      500,
      "EXPIRE_ANNOUNCEMENT_FAILED",
    );
  }

  return getAnnouncementById(actor, id);
}

export async function markAnnouncementRead(
  viewer: AppUser,
  id: string,
): Promise<Announcement> {
  const row = await getAnnouncementRow(id);
  await assertCanViewAnnouncement(viewer, row);

  const admin = createAdminClient();
  const { error } = await admin.from("announcement_reads").upsert(
    {
      announcement_id: id,
      user_id: viewer.id,
      read_at: new Date().toISOString(),
    },
    { onConflict: "announcement_id,user_id" },
  );

  if (error) {
    throw new ApiError(
      "تعذر تسجيل القراءة.",
      500,
      "MARK_ANNOUNCEMENT_READ_FAILED",
    );
  }

  return mapAnnouncementRow(row, true);
}

export async function markAnnouncementsRead(
  viewer: AppUser,
  ids: string[],
): Promise<{ updated: number }> {
  const uniqueIds = [...new Set(ids)];
  if (uniqueIds.length === 0) {
    return { updated: 0 };
  }

  const readableIds: string[] = [];
  for (const id of uniqueIds) {
    try {
      const row = await getAnnouncementRow(id);
      await assertCanViewAnnouncement(viewer, row);
      readableIds.push(id);
    } catch {
      // Skip IDs the viewer cannot access.
    }
  }

  if (readableIds.length === 0) {
    return { updated: 0 };
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error } = await admin.from("announcement_reads").upsert(
    readableIds.map((announcementId) => ({
      announcement_id: announcementId,
      user_id: viewer.id,
      read_at: now,
    })),
    { onConflict: "announcement_id,user_id" },
  );

  if (error) {
    throw new ApiError(
      "تعذر تسجيل القراءة.",
      500,
      "MARK_ANNOUNCEMENTS_READ_FAILED",
    );
  }

  return { updated: readableIds.length };
}
