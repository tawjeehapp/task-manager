import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { updateEmployeeRequestSchema } from "@/features/employee-requests/schemas/employee-request.schema";
import {
  getEmployeeRequestById,
  updateEmployeeRequest,
} from "@/features/employee-requests/services/employee-requests";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/employee-requests/[id]",
    });
    await requirePermission(user, PERMISSIONS.EMPLOYEE_REQUEST_VIEW);
    const { id } = await context.params;
    const item = await getEmployeeRequestById(user, id);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "PATCH /api/employee-requests/[id]",
    });
    await requirePermission(user, PERMISSIONS.EMPLOYEE_REQUEST_CREATE);
    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = updateEmployeeRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }
    const item = await updateEmployeeRequest(user, id, parsed.data);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}
