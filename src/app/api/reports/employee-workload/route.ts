import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { employeeWorkloadQuerySchema } from "@/features/reports/schemas/report.schema";
import { listEmployeeWorkloadReport } from "@/features/reports/services/reports";

export async function GET(request: Request) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/reports/employee-workload",
    });
    await requirePermission(user, PERMISSIONS.REPORT_VIEW);

    const url = new URL(request.url);
    const query = employeeWorkloadQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const result = await listEmployeeWorkloadReport(user, query);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
