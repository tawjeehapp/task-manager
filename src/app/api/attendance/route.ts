import { apiError, apiSuccess } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { listAttendanceQuerySchema } from "@/features/attendance/schemas/attendance.schema";
import { listAttendanceForViewer } from "@/features/attendance/services/attendance";

export async function GET(request: Request) {
  try {
    const user = await requireUser({ routeKey: "GET /api/attendance" });
    await requirePermission(user, PERMISSIONS.ATTENDANCE_VIEW);

    const url = new URL(request.url);
    const parsed = listAttendanceQuerySchema.safeParse({
      page: url.searchParams.get("page") ?? undefined,
      pageSize: url.searchParams.get("pageSize") ?? undefined,
      sortBy: url.searchParams.get("sortBy") ?? undefined,
      sortDir: url.searchParams.get("sortDir") ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      userId: url.searchParams.get("userId") ?? undefined,
      dateFrom: url.searchParams.get("dateFrom") ?? undefined,
      dateTo: url.searchParams.get("dateTo") ?? undefined,
      awaitingApproval: url.searchParams.get("awaitingApproval") ?? undefined,
    });

    if (!parsed.success) {
      throw new ApiError(
        parsed.error.issues[0]?.message ?? "بيانات غير صالحة",
        400,
        "VALIDATION_ERROR",
      );
    }

    const result = await listAttendanceForViewer(user, parsed.data);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
