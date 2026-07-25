import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import {
  createLeaveRequestSchema,
  listLeaveRequestsQuerySchema,
} from "@/features/leave/schemas/leave.schema";
import {
  createLeaveRequest,
  listLeaveRequests,
} from "@/features/leave/services/leave-requests";

export async function GET(request: Request) {
  try {
    const user = await requireUser({ routeKey: "GET /api/leave-requests" });
    await requirePermission(user, PERMISSIONS.LEAVE_VIEW);
    const url = new URL(request.url);
    const query = listLeaveRequestsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const result = await listLeaveRequests(user, query);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser({ routeKey: "POST /api/leave-requests" });
    await requirePermission(user, PERMISSIONS.LEAVE_VIEW);
    const body = createLeaveRequestSchema.parse(await request.json());
    const item = await createLeaveRequest(user, body);
    return apiSuccess(item, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
