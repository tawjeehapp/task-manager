import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { approveEmployeeRequestSchema } from "@/features/employee-requests/schemas/employee-request.schema";
import { approveEmployeeRequest } from "@/features/employee-requests/services/employee-requests";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/employee-requests/[id]/approve",
    });
    await requirePermission(user, PERMISSIONS.EMPLOYEE_REQUEST_APPROVE);
    const { id } = await context.params;

    let body: unknown = {};
    const text = await request.text();
    if (text.trim()) {
      body = JSON.parse(text) as unknown;
    }
    const input = approveEmployeeRequestSchema.parse(body);

    const item = await approveEmployeeRequest(user, id, input);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}
