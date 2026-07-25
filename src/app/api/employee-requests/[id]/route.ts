import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { getEmployeeRequestById } from "@/features/employee-requests/services/employee-requests";

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
