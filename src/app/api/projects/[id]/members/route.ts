import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { addProjectMemberSchema } from "@/features/projects/schemas/project.schema";
import {
  addProjectMember,
  listProjectMembers,
} from "@/features/projects/services/members";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/projects/[id]/members",
    });
    await requirePermission(user, PERMISSIONS.PROJECT_VIEW);

    const { id } = await context.params;
    const members = await listProjectMembers(user, id);
    return apiSuccess({ items: members });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/projects/[id]/members",
    });
    // Member management is scoped in the service (admin or department manager).
    await requirePermission(user, PERMISSIONS.PROJECT_VIEW);

    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = addProjectMemberSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const member = await addProjectMember(user, id, parsed.data);
    return apiSuccess(member, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
