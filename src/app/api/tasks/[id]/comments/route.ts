import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { createCommentSchema } from "@/features/tasks/schemas/comment.schema";
import {
  createTaskComment,
  listTaskComments,
} from "@/features/tasks/services/comments";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/tasks/[id]/comments",
    });
    const { id } = await context.params;
    const items = await listTaskComments(user, id);
    return apiSuccess(items);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/tasks/[id]/comments",
    });
    const { id } = await context.params;
    const body = (await request.json()) as unknown;
    const parsed = createCommentSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }
    const comment = await createTaskComment(user, id, parsed.data);
    return apiSuccess(comment, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
