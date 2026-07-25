import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { rejectLeaveRequestSchema } from "@/features/leave/schemas/leave.schema";
import { rejectLeaveRequest } from "@/features/leave/services/leave-requests";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/leave-requests/[id]/reject",
    });
    await requirePermission(user, PERMISSIONS.LEAVE_APPROVE);
    const { id } = await context.params;
    const body = rejectLeaveRequestSchema.parse(await request.json());
    const item = await rejectLeaveRequest(user, id, body);
    return apiSuccess(item);
  } catch (error) {
    return apiError(error);
  }
}
