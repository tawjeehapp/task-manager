import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { submitAttendanceSchema } from "@/features/attendance/schemas/attendance.schema";
import { submitAttendance } from "@/features/attendance/services/attendance";

export async function POST(request: Request) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/attendance/submit",
    });
    await requirePermission(user, PERMISSIONS.ATTENDANCE_VIEW);

    const body = await request.json().catch(() => ({}));
    const parsed = submitAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const record = await submitAttendance(user, parsed.data);
    return apiSuccess(record, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
