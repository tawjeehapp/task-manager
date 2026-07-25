import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { moveDepartmentMemberSchema } from "@/features/departments/schemas/department.schema";
import { moveDepartmentMember } from "@/features/departments/services/memberships";

export async function POST(request: Request) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/departments/members/move",
    });
    await requirePermission(user, PERMISSIONS.DEPARTMENT_MANAGE);

    const body: unknown = await request.json();
    const parsed = moveDepartmentMemberSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const membership = await moveDepartmentMember(parsed.data);
    return apiSuccess(membership);
  } catch (error) {
    return apiError(error);
  }
}
