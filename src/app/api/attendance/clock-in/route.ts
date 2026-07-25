import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { clockIn } from "@/features/attendance/services/attendance";

export async function POST() {
  try {
    const user = await requireUser({ routeKey: "POST /api/attendance/clock-in" });
    await requirePermission(user, PERMISSIONS.ATTENDANCE_VIEW);
    const record = await clockIn(user);
    return apiSuccess(record, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
