import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { ganttQuerySchema } from "@/features/gantt/schemas/gantt.schema";
import { getProjectGantt } from "@/features/gantt/services/gantt";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/projects/[id]/gantt",
    });
    const { id } = await context.params;
    const url = new URL(request.url);
    const parsed = ganttQuerySchema.safeParse({
      status: url.searchParams.get("status") ?? undefined,
      assignee: url.searchParams.get("assignee") ?? undefined,
      dueFrom: url.searchParams.get("dueFrom") ?? undefined,
      dueTo: url.searchParams.get("dueTo") ?? undefined,
    });
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }
    const result = await getProjectGantt(user, id, parsed.data);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
