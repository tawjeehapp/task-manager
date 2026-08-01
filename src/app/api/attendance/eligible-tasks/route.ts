import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { listEligibleTasksForAttendance } from "@/features/attendance/services/attendance";

export async function GET() {
  try {
    const user = await requireUser({
      routeKey: "GET /api/attendance/eligible-tasks",
    });
    await requirePermission(user, PERMISSIONS.ATTENDANCE_VIEW);
    const items = await listEligibleTasksForAttendance(user.id);
    return apiSuccess({ items });
  } catch (error) {
    return apiError(error);
  }
}
