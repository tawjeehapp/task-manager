import { apiError, apiSuccess } from "@/lib/api/response";
import { requireUser } from "@/lib/auth/require-user";
import { requirePermission } from "@/lib/auth/require-permission";
import { PERMISSIONS } from "@/lib/permissions";
import { taskCompletionQuerySchema } from "@/features/reports/schemas/report.schema";
import { listTaskCompletionReport } from "@/features/reports/services/reports";

export async function GET(request: Request) {
  try {
    const user = await requireUser({
      routeKey: "GET /api/reports/task-completion",
    });
    await requirePermission(user, PERMISSIONS.REPORT_VIEW);

    const url = new URL(request.url);
    const query = taskCompletionQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries()),
    );
    const result = await listTaskCompletionReport(user, query);
    return apiSuccess(result);
  } catch (error) {
    return apiError(error);
  }
}
