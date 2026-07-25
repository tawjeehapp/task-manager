import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { rejectAttendanceSchema } from "@/features/attendance/schemas/attendance.schema";
import { rejectAttendance } from "@/features/attendance/services/attendance";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({
      routeKey: "POST /api/attendance/[id]/reject",
    });
    await requirePermission(user, PERMISSIONS.ATTENDANCE_APPROVE);
    const { id } = await context.params;

    const body = await request.json();
    const parsed = rejectAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const record = await rejectAttendance(user, id, parsed.data);
    return apiSuccess(record);
  } catch (error) {
    return apiError(error);
  }
}
