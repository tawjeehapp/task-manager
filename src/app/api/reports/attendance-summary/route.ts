import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { attendanceSummaryQuerySchema } from "@/features/reports/schemas/report.schema";
import { listAttendanceSummaryReport } from "@/features/reports/services/reports";

export async function GET(request: Request) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/reports/attendance-summary",
    });
    await requirePermission(user, PERMISSIONS.REPORT_VIEW);

    const url = new URL(request.url);
    const query = attendanceSummaryQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const result = await listAttendanceSummaryReport(user, query);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
