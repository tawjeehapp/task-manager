import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { getTodayAttendance } from "@/features/attendance/services/attendance";

export async function GET() {
  try {
    const user = await requireUser({ routeKey: "GET /api/attendance/today" });
    await requirePermission(user, PERMISSIONS.ATTENDANCE_VIEW);
    const record = await getTodayAttendance(user);
    return apiSuccess(record);
  } catch (error) {
    return apiError(error);
  }
}
