import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { deleteTaskAttachment } from "@/features/tasks/services/attachments";

type RouteContext = {
  params: Promise<{ id: string; attachmentId: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "DELETE /api/tasks/[id]/attachments/[attachmentId]",
    });
    const { id, attachmentId } = await context.params;
    await deleteTaskAttachment(user, id, attachmentId);
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
