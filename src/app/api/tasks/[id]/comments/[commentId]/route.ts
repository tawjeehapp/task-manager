import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { updateCommentSchema } from "@/features/tasks/schemas/comment.schema";
import {
  deleteTaskComment,
  updateTaskComment,
} from "@/features/tasks/services/comments";

type RouteContext = {
  params: Promise<{ id: string; commentId: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "PATCH /api/tasks/[id]/comments/[commentId]",
    });
    const { id, commentId } = await context.params;
    const body = (await request.json()) as unknown;
    const parsed = updateCommentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }
    const comment = await updateTaskComment(user, id, commentId, parsed.data);
    return apiSuccess(comment);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "DELETE /api/tasks/[id]/comments/[commentId]",
    });
    const { id, commentId } = await context.params;
    await deleteTaskComment(user, id, commentId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
