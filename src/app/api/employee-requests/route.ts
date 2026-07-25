import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createEmployeeRequestSchema,
  listEmployeeRequestsQuerySchema,
} from "@/features/employee-requests/schemas/employee-request.schema";
import {
  createEmployeeRequest,
  listEmployeeRequests,
} from "@/features/employee-requests/services/employee-requests";

export async function GET(request: Request) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/employee-requests",
    });
    await requirePermission(user, PERMISSIONS.EMPLOYEE_REQUEST_VIEW);
    const url = new URL(request.url);
    const query = listEmployeeRequestsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const result = await listEmployeeRequests(user, query);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/employee-requests",
    });
    await requirePermission(user, PERMISSIONS.EMPLOYEE_REQUEST_CREATE);
    const body = createEmployeeRequestSchema.parse(await request.json());
    const item = await createEmployeeRequest(user, body);
    return apiSuccess(item, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
