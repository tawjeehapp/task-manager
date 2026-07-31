import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { resubmitAttendanceSchema } from "@/features/attendance/schemas/attendance.schema";
import { resubmitAttendance } from "@/features/attendance/services/attendance";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/attendance/[id]/resubmit",
    });
    await requirePermission(user, PERMISSIONS.ATTENDANCE_VIEW);
    const { id } = await context.params;

    const body = await request.json().catch(() => ({}));
    const parsed = resubmitAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const record = await resubmitAttendance(user, id, parsed.data);
    return apiSuccess(record);
  } catch (error) {
    return apiError(error);
  }
}
