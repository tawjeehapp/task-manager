import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { listTaskActivityQuerySchema } from "@/features/tasks/schemas/dependency.schema";
import { listTaskActivity } from "@/features/tasks/services/activity-logs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/tasks/[id]/activity",
    });
    const { id } = await context.params;
    const url = new URL(request.url);
    const parsed = listTaskActivityQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const result = await listTaskActivity(user, id, parsed.data);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
