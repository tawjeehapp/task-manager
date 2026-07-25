import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { approveAttendance } from "@/features/attendance/services/attendance";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/attendance/[id]/approve",
    });
    await requirePermission(user, PERMISSIONS.ATTENDANCE_APPROVE);
    const { id } = await context.params;
    const record = await approveAttendance(user, id);
    return apiSuccess(record);
  } catch (error) {
    return apiError(error);
  }
}
