import "server-only";

import { randomUUID } from "crypto";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import {
  assertCanAccessTask,
  assertCanViewTaskAttachments,
} from "@/features/tasks/services/assert-can-access-task";
import {
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_BYTES,
  attachmentFileMetaSchema,
} from "@/features/tasks/schemas/attachment.schema";
import type {
  TaskAttachment,
  TaskAttachmentSummary,
} from "@/features/tasks/types/comment-attachment.types";
import { createAdminClient } from "@/lib/supabase/admin";

export const TASK_FILES_BUCKET = "task-files";

export type { TaskAttachment, TaskAttachmentSummary };

type AttachmentRow = {
  id: string;
  task_id: string;
  uploaded_by: string;
  file_name: string;
  storage_path: string;
  byte_size: number;
  content_type: string | null;
  created_at: string;
  uploader: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
};

const ATTACHMENT_SELECT =
  "id, task_id, uploaded_by, file_name, storage_path, byte_size, content_type, created_at, uploader:users!uploaded_by(id, full_name, employee_number)";

function mapAttachment(
  row: AttachmentRow,
  includeEmployeeNumber: boolean,
): TaskAttachment {
  return {
    id: row.id,
    taskId: row.task_id,
    uploadedBy: row.uploaded_by,
    fileName: row.file_name,
    storagePath: row.storage_path,
    byteSize: Number(row.byte_size ?? 0),
    contentType: row.content_type,
    createdAt: row.created_at,
    uploader: row.uploader
      ? {
          id: row.uploader.id,
          fullName: row.uploader.full_name,
          ...(includeEmployeeNumber
            ? { employeeNumber: row.uploader.employee_number }
            : {}),
        }
      : null,
  };
}

function canModerateAttachments(viewer: AppUser): boolean {
  return viewer.role === "admin" || viewer.role === "department_manager";
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-()\u0600-\u06FF ]+/g, "_").slice(0, 200);
}

/** Batch-load attachment summaries for task list / board rows. */
export async function getAttachmentSummariesByTaskIds(
  taskIds: string[],
): Promise<Map<string, TaskAttachmentSummary[]>> {
  const result = new Map<string, TaskAttachmentSummary[]>();
  if (taskIds.length === 0) {
    return result;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("task_attachments")
    .select("id, task_id, file_name, byte_size, content_type")
    .in("task_id", taskIds)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ApiError("تعذر جلب المرفقات.", 500, "LIST_ATTACHMENTS_FAILED");
  }

  for (const row of data ?? []) {
    const taskId = row.task_id as string;
    const list = result.get(taskId) ?? [];
    list.push({
      id: row.id as string,
      fileName: row.file_name as string,
      byteSize: Number(row.byte_size ?? 0),
      contentType: (row.content_type as string | null) ?? null,
    });
    result.set(taskId, list);
  }

  return result;
}

export async function listTaskAttachments(
  viewer: AppUser,
  taskId: string,
): Promise<TaskAttachment[]> {
  await assertCanViewTaskAttachments(viewer, taskId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("task_attachments")
    .select(ATTACHMENT_SELECT)
    .eq("task_id", taskId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new ApiError("تعذر جلب المرفقات.", 500, "LIST_ATTACHMENTS_FAILED");
  }

  const includeEmployeeNumber = viewer.role !== "employee";
  return ((data ?? []) as unknown as AttachmentRow[]).map((row) =>
    mapAttachment(row, includeEmployeeNumber),
  );
}

export async function uploadTaskAttachment(
  viewer: AppUser,
  taskId: string,
  file: File,
): Promise<TaskAttachment> {
  const access = await assertCanAccessTask(viewer, taskId);

  if (file.size <= 0) {
    throw new ApiError("الملف فارغ.", 400, "VALIDATION_ERROR");
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    throw new ApiError(
      "حجم الملف يتجاوز الحد المسموح (10 ميجابايت).",
      400,
      "FILE_TOO_LARGE",
    );
  }

  const contentType = file.type || "application/octet-stream";
  if (
    !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
      contentType as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
    )
  ) {
    throw new ApiError("نوع الملف غير مسموح.", 400, "INVALID_FILE_TYPE");
  }

  const meta = attachmentFileMetaSchema.parse({
    fileName: file.name,
    contentType,
    byteSize: file.size,
  });

  const safeName = sanitizeFileName(meta.fileName);
  const storagePath = `${access.projectId}/${taskId}/${randomUUID()}-${safeName}`;
  const admin = createAdminClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from(TASK_FILES_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new ApiError("تعذر رفع الملف.", 500, "UPLOAD_FAILED");
  }

  const { data, error } = await admin
    .from("task_attachments")
    .insert({
      task_id: taskId,
      uploaded_by: viewer.id,
      file_name: meta.fileName,
      storage_path: storagePath,
      byte_size: meta.byteSize,
      content_type: contentType,
    })
    .select(ATTACHMENT_SELECT)
    .single();

  if (error || !data) {
    await admin.storage.from(TASK_FILES_BUCKET).remove([storagePath]);
    throw new ApiError(
      "تعذر حفظ بيانات المرفق.",
      500,
      "CREATE_ATTACHMENT_FAILED",
    );
  }

  return mapAttachment(data as unknown as AttachmentRow, true);
}

export async function deleteTaskAttachment(
  viewer: AppUser,
  taskId: string,
  attachmentId: string,
): Promise<void> {
  await assertCanAccessTask(viewer, taskId);
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("task_attachments")
    .select("id, task_id, uploaded_by, storage_path")
    .eq("id", attachmentId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (existingError) {
    throw new ApiError("تعذر حذف المرفق.", 500, "DELETE_ATTACHMENT_FAILED");
  }
  if (!existing) {
    throw new ApiError("المرفق غير موجود.", 404, "ATTACHMENT_NOT_FOUND");
  }
  if (
    existing.uploaded_by !== viewer.id &&
    !canModerateAttachments(viewer)
  ) {
    throw new ApiError("ليس لديك صلاحية لحذف هذا المرفق.", 403, "FORBIDDEN");
  }

  const { error } = await admin
    .from("task_attachments")
    .delete()
    .eq("id", attachmentId);

  if (error) {
    throw new ApiError("تعذر حذف المرفق.", 500, "DELETE_ATTACHMENT_FAILED");
  }

  await admin.storage
    .from(TASK_FILES_BUCKET)
    .remove([existing.storage_path as string]);
}

export async function getAttachmentDownloadUrl(
  viewer: AppUser,
  taskId: string,
  attachmentId: string,
): Promise<{ url: string; fileName: string }> {
  await assertCanViewTaskAttachments(viewer, taskId);
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("task_attachments")
    .select("id, file_name, storage_path")
    .eq("id", attachmentId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (existingError) {
    throw new ApiError(
      "تعذر إنشاء رابط التحميل.",
      500,
      "DOWNLOAD_URL_FAILED",
    );
  }
  if (!existing) {
    throw new ApiError("المرفق غير موجود.", 404, "ATTACHMENT_NOT_FOUND");
  }

  const { data, error } = await admin.storage
    .from(TASK_FILES_BUCKET)
    .createSignedUrl(existing.storage_path as string, 60);

  if (error || !data?.signedUrl) {
    throw new ApiError(
      "تعذر إنشاء رابط التحميل.",
      500,
      "DOWNLOAD_URL_FAILED",
    );
  }

  return {
    url: data.signedUrl,
    fileName: existing.file_name as string,
  };
}
