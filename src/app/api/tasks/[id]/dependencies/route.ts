import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { addTaskDependencySchema } from "@/features/tasks/schemas/dependency.schema";
import {
  addTaskDependency,
  listTaskDependencies,
} from "@/features/tasks/services/dependencies";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/tasks/[id]/dependencies",
    });
    const { id } = await context.params;
    const items = await listTaskDependencies(user, id);
    return apiSuccess({ items });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/tasks/[id]/dependencies",
    });
    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = addTaskDependencySchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const dependency = await addTaskDependency(user, id, parsed.data);
    return apiSuccess(dependency, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
