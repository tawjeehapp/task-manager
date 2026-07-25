import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { rejectEmployeeRequestSchema } from "@/features/employee-requests/schemas/employee-request.schema";
import { rejectEmployeeRequest } from "@/features/employee-requests/services/employee-requests";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/employee-requests/[id]/reject",
    });
    await requirePermission(user, PERMISSIONS.EMPLOYEE_REQUEST_APPROVE);
    const { id } = await context.params;
    const body = rejectEmployeeRequestSchema.parse(await request.json());
    const item = await rejectEmployeeRequest(user, id, body);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}
