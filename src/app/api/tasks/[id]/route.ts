import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { updateTaskSchema } from "@/features/tasks/schemas/task.schema";
import {
  getTaskForViewer,
  updateTask,
  deleteTask,
} from "@/features/tasks/services/tasks";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "GET /api/tasks/[id]" });
    const { id } = await context.params;
    const task = await getTaskForViewer(user, id);
    return apiSuccess(task);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "PATCH /api/tasks/[id]" });
    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const task = await updateTask(user, id, parsed.data);
    return apiSuccess(task);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "DELETE /api/tasks/[id]" });
    const { id } = await context.params;
    await deleteTask(user, id);
    return apiSuccess({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
