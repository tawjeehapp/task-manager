import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { updateAttendanceSchema } from "@/features/attendance/schemas/attendance.schema";
import {
  getAttendanceById,
  updateAttendance,
} from "@/features/attendance/services/attendance";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "GET /api/attendance/[id]" });
    await requirePermission(user, PERMISSIONS.ATTENDANCE_VIEW);
    const { id } = await context.params;
    const record = await getAttendanceById(user, id);
    return apiSuccess(record);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const user = await requireUser({ routeKey: "PATCH /api/attendance/[id]" });
    await requirePermission(user, PERMISSIONS.ATTENDANCE_VIEW);
    const { id } = await context.params;

    const body = await request.json();
    const parsed = updateAttendanceSchema.safeParse(body);
    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const record = await updateAttendance(user, id, parsed.data);
    return apiSuccess(record);
  } catch (error) {
    return apiError(error);
  }
}
