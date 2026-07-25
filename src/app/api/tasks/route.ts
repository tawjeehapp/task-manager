import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createTaskSchema,
  listTasksQuerySchema,
} from "@/features/tasks/schemas/task.schema";
import {
  createTask,
  listTasksForViewer,
} from "@/features/tasks/services/tasks";

export async function GET(request: Request) {
  try {
    const user = await requireUser({ routeKey: "GET /api/tasks" });
    await requirePermission(user, PERMISSIONS.PROJECT_VIEW);

    const url = new URL(request.url);
    const parsed = listTasksQuerySchema.safeParse({
      projectId: url.searchParams.get("projectId") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      assignee: url.searchParams.get("assignee") ?? undefined,
      priority: url.searchParams.get("priority") ?? undefined,
      parentTaskId: url.searchParams.get("parentTaskId") ?? undefined,
      dueFrom: url.searchParams.get("dueFrom") ?? undefined,
      dueTo: url.searchParams.get("dueTo") ?? undefined,
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      sortBy: url.searchParams.get("sortBy") ?? undefined,
      sortDir: url.searchParams.get("sortDir") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const result = await listTasksForViewer(user, parsed.data);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser({ routeKey: "POST /api/tasks" });
    await requirePermission(user, PERMISSIONS.TASK_CREATE);

    const body: unknown = await request.json();
    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const task = await createTask(user, parsed.data);
    return apiSuccess(task, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
