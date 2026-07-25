import "server-only";

import { ApiError } from "@/lib/api/errors";
import type { AppUser } from "@/lib/auth/types";
import { assertCanAccessTask } from "@/features/tasks/services/assert-can-access-task";
import type {
  CreateCommentInput,
  UpdateCommentInput,
} from "@/features/tasks/schemas/comment.schema";
import type { TaskComment } from "@/features/tasks/types/comment-attachment.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type { TaskComment };

type CommentRow = {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    full_name: string;
    employee_number: string;
  } | null;
};

const COMMENT_SELECT =
  "id, task_id, user_id, content, created_at, updated_at, user:users!user_id(id, full_name, employee_number)";

function mapComment(row: CommentRow): TaskComment {
  return {
    id: row.id,
    taskId: row.task_id,
    userId: row.user_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    user: row.user
      ? {
          id: row.user.id,
          fullName: row.user.full_name,
          employeeNumber: row.user.employee_number,
        }
      : null,
  };
}

function canModerateComments(viewer: AppUser): boolean {
  return viewer.role === "admin" || viewer.role === "department_manager";
}

export async function listTaskComments(
  viewer: AppUser,
  taskId: string,
): Promise<TaskComment[]> {
  await assertCanAccessTask(viewer, taskId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("task_comments")
    .select(COMMENT_SELECT)
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new ApiError("تعذر جلب التعليقات.", 500, "LIST_COMMENTS_FAILED");
  }

  return ((data ?? []) as unknown as CommentRow[]).map(mapComment);
}

export async function createTaskComment(
  viewer: AppUser,
  taskId: string,
  input: CreateCommentInput,
): Promise<TaskComment> {
  await assertCanAccessTask(viewer, taskId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("task_comments")
    .insert({
      task_id: taskId,
      user_id: viewer.id,
      content: input.content,
    })
    .select(COMMENT_SELECT)
    .single();

  if (error || !data) {
    throw new ApiError("تعذر إضافة التعليق.", 500, "CREATE_COMMENT_FAILED");
  }

  return mapComment(data as unknown as CommentRow);
}

export async function updateTaskComment(
  viewer: AppUser,
  taskId: string,
  commentId: string,
  input: UpdateCommentInput,
): Promise<TaskComment> {
  await assertCanAccessTask(viewer, taskId);
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("task_comments")
    .select("id, task_id, user_id")
    .eq("id", commentId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (existingError) {
    throw new ApiError("تعذر تحديث التعليق.", 500, "UPDATE_COMMENT_FAILED");
  }
  if (!existing) {
    throw new ApiError("التعليق غير موجود.", 404, "COMMENT_NOT_FOUND");
  }
  if (existing.user_id !== viewer.id) {
    throw new ApiError("يمكنك تعديل تعليقاتك فقط.", 403, "FORBIDDEN");
  }

  const { data, error } = await admin
    .from("task_comments")
    .update({ content: input.content })
    .eq("id", commentId)
    .select(COMMENT_SELECT)
    .single();

  if (error || !data) {
    throw new ApiError("تعذر تحديث التعليق.", 500, "UPDATE_COMMENT_FAILED");
  }

  return mapComment(data as unknown as CommentRow);
}

export async function deleteTaskComment(
  viewer: AppUser,
  taskId: string,
  commentId: string,
): Promise<void> {
  await assertCanAccessTask(viewer, taskId);
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("task_comments")
    .select("id, task_id, user_id")
    .eq("id", commentId)
    .eq("task_id", taskId)
    .maybeSingle();

  if (existingError) {
    throw new ApiError("تعذر حذف التعليق.", 500, "DELETE_COMMENT_FAILED");
  }
  if (!existing) {
    throw new ApiError("التعليق غير موجود.", 404, "COMMENT_NOT_FOUND");
  }
  if (existing.user_id !== viewer.id && !canModerateComments(viewer)) {
    throw new ApiError("ليس لديك صلاحية لحذف هذا التعليق.", 403, "FORBIDDEN");
  }

  const { error } = await admin
    .from("task_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    throw new ApiError("تعذر حذف التعليق.", 500, "DELETE_COMMENT_FAILED");
  }
}
