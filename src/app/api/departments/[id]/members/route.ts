import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { tryLogEntityActivity } from "@/features/activity/services/entity-activity";
import {
  addDepartmentMemberSchema,
  listMembersQuerySchema,
} from "@/features/departments/schemas/department.schema";
import { assertCanAccessDepartment } from "@/features/departments/services/assert-can-access-department";
import {
  addDepartmentMember,
  listDepartmentMembers,
} from "@/features/departments/services/memberships";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/departments/[id]/members",
    });
    await requirePermission(user, PERMISSIONS.DEPARTMENT_VIEW);

    const { id } = await context.params;
    await assertCanAccessDepartment(user, id);

    const url = new URL(request.url);
    const parsed = listMembersQuerySchema.safeParse({
      includeHistory: url.searchParams.get("includeHistory") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    // History is admin-only
    const includeHistory =
      parsed.data.includeHistory === true && user.role === "admin";

    const members = await listDepartmentMembers(id, { includeHistory });
    return apiSuccess({ items: members });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/departments/[id]/members",
    });
    await requirePermission(user, PERMISSIONS.DEPARTMENT_MANAGE);

    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = addDepartmentMemberSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const membership = await addDepartmentMember(id, parsed.data);
    await tryLogEntityActivity(
      user.id,
      "department",
      id,
      "department.member_added",
      {
        userId: parsed.data.userId,
        fullName: membership.user?.fullName,
      },
    );
    return apiSuccess(membership, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
